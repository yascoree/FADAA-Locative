from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.paiement import ModePaiement, Paiement
from app.models.quittance import Quittance, QuittanceStatus
from app.models.utilisateur import Utilisateur

MODE_PAIEMENT_LABELS = {
    ModePaiement.ESPECES: "Espèces",
    ModePaiement.VIREMENT: "Virement",
    ModePaiement.CHEQUE: "Chèque",
    ModePaiement.CARTE: "Carte",
    ModePaiement.MOBILE_MONEY: "Mobile Money",
}

QUITTANCE_STATUS_LABELS = {
    QuittanceStatus.EMISE: "Émise",
    QuittanceStatus.ANNULEE: "Annulée",
}

QUITTANCE_STATUS_COLORS = {
    QuittanceStatus.EMISE: "#3a7a3a",
    QuittanceStatus.ANNULEE: "#c0392b",
}

# Mêmes teintes que --brand-primary/--brand-primary-dark/--brand-text/... dans
# app/globals.css côté front : le PDF doit avoir le même habillage que l'app.
PRIMARY = HexColor("#889063")
PRIMARY_DARK = HexColor("#6d7450")
TEXT = HexColor("#2a2820")
TEXT_MUTED = HexColor("#8c8570")
BORDER = HexColor("#e3ddd0")
CARD_BG = HexColor("#fcfbf8")
WHITE = HexColor("#ffffff")

# app/services/receipt_service.py -> parents[2] = racine du backend.
# Volontairement HORS de uploads/ (qui est monté en statique, donc public) : une
# quittance contient des données personnelles/financières et ne doit être
# accessible que via /receipts/{id}/download, avec vérification des droits.
RECEIPTS_DIR = Path(__file__).resolve().parents[2] / "storage" / "receipts"

ASSETS_DIR = Path(__file__).resolve().parents[1] / "assets"
LOGO_FULL_PATH = ASSETS_DIR / "logo-full.png"
LOGO_FULL_RATIO = 978 / 450  # largeur / hauteur du PNG source
ICON_PATH = ASSETS_DIR / "icon.png"
ICON_RATIO = 384 / 368

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
HEADER_H = 42 * mm
FOOTER_H = 13 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


def _format_date(value):
    return value.strftime("%d/%m/%Y") if value else "—"


def _format_amount(value):
    return f"{value:.2f} MAD" if value is not None else "—"


def _draw_watermark(c: canvas.Canvas) -> None:
    """Icône géante et très pâle derrière tout le contenu — apporte de la
    texture/du "background" sans jamais gêner la lecture."""
    if not ICON_PATH.exists():
        return
    size = 150 * mm
    x = (PAGE_W - size) / 2
    y = (PAGE_H - HEADER_H - FOOTER_H) / 2 + FOOTER_H - size / 2
    c.saveState()
    c.setFillAlpha(0.05)
    c.drawImage(str(ICON_PATH), x, y, width=size, height=size / ICON_RATIO, mask="auto", preserveAspectRatio=True)
    c.restoreState()


def _draw_header(c: canvas.Canvas, quittance: Quittance) -> None:
    c.setFillColor(PRIMARY)
    c.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, stroke=0, fill=1)
    c.setFillColor(PRIMARY_DARK)
    c.rect(0, PAGE_H - HEADER_H, PAGE_W, 1.4 * mm, stroke=0, fill=1)

    # Logo bien visible : carte blanche arrondie dans le bandeau de couleur, pour
    # un contraste maximal quel que soit l'écran/l'imprimante.
    chip_w, chip_h, chip_pad = 60 * mm, 21 * mm, 3 * mm
    chip_x, chip_y = MARGIN, PAGE_H - HEADER_H + (HEADER_H - chip_h) / 2
    c.setFillColor(WHITE)
    c.roundRect(chip_x, chip_y, chip_w, chip_h, 3 * mm, stroke=0, fill=1)
    if LOGO_FULL_PATH.exists():
        logo_h = chip_h - 2 * chip_pad
        logo_w = logo_h * LOGO_FULL_RATIO
        if logo_w > chip_w - 2 * chip_pad:
            logo_w = chip_w - 2 * chip_pad
            logo_h = logo_w / LOGO_FULL_RATIO
        c.drawImage(
            str(LOGO_FULL_PATH),
            chip_x + (chip_w - logo_w) / 2,
            chip_y + (chip_h - logo_h) / 2,
            width=logo_w,
            height=logo_h,
            mask="auto",
            preserveAspectRatio=True,
        )

    title_x = chip_x + chip_w + 8 * mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(title_x, PAGE_H - HEADER_H / 2 + 1 * mm, "QUITTANCE DE LOYER")
    c.setFont("Helvetica", 9.5)
    c.setFillColor(HexColor("#f1efe6"))
    c.drawString(
        title_x,
        PAGE_H - HEADER_H / 2 - 7 * mm,
        f"Quittance n° {quittance.id} — générée le {_format_date(quittance.date_generation)}",
    )


def _draw_status_pill(c: canvas.Canvas, quittance: Quittance, y: float) -> None:
    label = QUITTANCE_STATUS_LABELS.get(quittance.statut, "—").upper()
    color = HexColor(QUITTANCE_STATUS_COLORS.get(quittance.statut, "#000000"))
    c.setFont("Helvetica-Bold", 9)
    text_w = c.stringWidth(label, "Helvetica-Bold", 9)
    pad_x, pill_h = 4.5 * mm, 7.5 * mm
    pill_w = text_w + 2 * pad_x
    pill_x = PAGE_W - MARGIN - pill_w
    c.setFillColor(color)
    c.roundRect(pill_x, y, pill_w, pill_h, pill_h / 2, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.drawCentredString(pill_x + pill_w / 2, y + pill_h / 2 - 3.1, label)


def _section(c: canvas.Canvas, y_top: float, title: str, rows: list[tuple[str, str]]) -> float:
    """Dessine une carte de section (titre + lignes label/valeur) et renvoie le
    y du haut de la prochaine carte."""
    row_h = 7.6 * mm
    title_h = 11 * mm
    box_h = title_h + row_h * len(rows) + 4 * mm
    box_y = y_top - box_h

    c.setFillColor(CARD_BG)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.7)
    c.roundRect(MARGIN, box_y, CONTENT_W, box_h, 2.5 * mm, stroke=1, fill=1)

    bullet_x = MARGIN + 5 * mm
    text_x = MARGIN + 8.5 * mm
    title_y = y_top - 7.5 * mm
    c.setFillColor(PRIMARY)
    c.rect(bullet_x - 1.6 * mm, title_y - 0.2, 3.2 * mm, 3.2 * mm, stroke=0, fill=1)
    c.setFillColor(PRIMARY_DARK)
    c.setFont("Helvetica-Bold", 11.5)
    c.drawString(text_x, title_y, title.upper())

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN + 4 * mm, y_top - title_h, PAGE_W - MARGIN - 4 * mm, y_top - title_h)

    row_y = y_top - title_h - 6 * mm
    label_x = MARGIN + 8.5 * mm
    value_x = MARGIN + 62 * mm
    for label, value in rows:
        c.setFont("Helvetica", 9.5)
        c.setFillColor(TEXT_MUTED)
        c.drawString(label_x, row_y, label)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(TEXT)
        c.drawString(value_x, row_y, str(value))
        row_y -= row_h

    return box_y - 6 * mm


def _draw_footer(c: canvas.Canvas) -> None:
    c.setFillColor(PRIMARY)
    c.rect(0, 0, PAGE_W, FOOTER_H, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 8)
    c.drawCentredString(PAGE_W / 2, FOOTER_H / 2 - 2.6, "Document généré automatiquement par FADAA Locative")


def generate_receipt_pdf(db: Session, quittance: Quittance) -> str:
    """Génère le PDF d'une quittance et retourne son chemin absolu. Régénère à
    chaque appel : sûr à ré-invoquer (ex: téléchargement d'une quittance dont le
    fichier a été perdu, ou pour refléter une annulation). Un seul et même
    fichier par paiement (quittance_{id}.pdf) : si le paiement a été annulé, le
    document reste identique mais affiche en plus une petite référence
    indiquant qui a annulé le paiement et quand."""
    paiement = db.get(Paiement, quittance.paiement_id)
    echeance = db.get(Echeance, paiement.echeance_id)
    bail = db.get(Bail, echeance.bail_id)
    lot = db.get(Lot, bail.lot_id)
    bien = db.get(Bien, lot.bien_id)
    locataire = db.get(Utilisateur, bail.locataire_id)
    proprietaire = db.get(Utilisateur, bien.proprietaire_id)

    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = RECEIPTS_DIR / f"quittance_{quittance.id}.pdf"

    c = canvas.Canvas(str(file_path), pagesize=A4)

    _draw_watermark(c)
    _draw_header(c, quittance)

    pill_y = PAGE_H - HEADER_H - 10 * mm - 7.5 * mm
    _draw_status_pill(c, quittance, pill_y)
    y = pill_y - 6 * mm

    y = _section(
        c,
        y,
        "Bailleur",
        [
            ("Nom :", f"{proprietaire.prenom} {proprietaire.nom}" if proprietaire else "—"),
            ("Email :", proprietaire.email if proprietaire else "—"),
        ],
    )
    y = _section(
        c,
        y,
        "Locataire",
        [
            ("Nom :", f"{locataire.prenom} {locataire.nom}" if locataire else "—"),
            ("Email :", locataire.email if locataire else "—"),
        ],
    )
    y = _section(
        c,
        y,
        "Bien loué",
        [
            ("Désignation :", bien.designation or f"Bien #{bien.id}"),
            ("Lot :", lot.reference or f"Lot #{lot.id}"),
        ],
    )
    y = _section(
        c,
        y,
        "Paiement",
        [
            ("Période (échéance) :", _format_date(echeance.date_echeance)),
            ("Montant payé :", _format_amount(paiement.montant)),
            ("Mode de paiement :", MODE_PAIEMENT_LABELS.get(paiement.mode_paiement, "—")),
            ("Date de paiement :", _format_date(paiement.date_paiement)),
        ],
    )

    if quittance.statut == QuittanceStatus.ANNULEE:
        annulateur = db.get(Utilisateur, paiement.annule_par) if paiement.annule_par else None
        annulateur_label = f"{annulateur.prenom} {annulateur.nom}" if annulateur else "—"
        note = (
            f"Paiement annulé le {_format_date(paiement.date_annulation)} par {annulateur_label}"
            + (f" — Motif : {paiement.motif_annulation}" if paiement.motif_annulation else "")
        )
        note_h = 10 * mm
        c.setFillColor(HexColor("#fbeceb"))
        c.setStrokeColor(HexColor("#e6b3ad"))
        c.setLineWidth(0.7)
        c.roundRect(MARGIN, y - note_h, CONTENT_W, note_h, 2.5 * mm, stroke=1, fill=1)
        c.setFillColor(HexColor("#c0392b"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(MARGIN + 5 * mm, y - note_h / 2 - 3, note)

    _draw_footer(c)

    c.showPage()
    c.save()

    return str(file_path)
