from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.models.bail import Bail
from app.models.bien import Bien
from app.models.echeance import Echeance
from app.models.lot import Lot
from app.models.paiement import ModePaiement, Paiement
from app.models.quittance import Quittance
from app.models.utilisateur import Utilisateur

MODE_PAIEMENT_LABELS = {
    ModePaiement.ESPECES: "Espèces",
    ModePaiement.VIREMENT: "Virement",
    ModePaiement.CHEQUE: "Chèque",
    ModePaiement.CARTE: "Carte",
    ModePaiement.MOBILE_MONEY: "Mobile Money",
}

# app/services/receipt_service.py -> parents[2] = racine du backend.
# Volontairement HORS de uploads/ (qui est monté en statique, donc public) : une
# quittance contient des données personnelles/financières et ne doit être
# accessible que via /receipts/{id}/download, avec vérification des droits.
RECEIPTS_DIR = Path(__file__).resolve().parents[2] / "storage" / "receipts"


def _format_date(value):
    return value.strftime("%d/%m/%Y") if value else "—"


def _format_amount(value):
    return f"{value:.2f} MAD" if value is not None else "—"


def generate_receipt_pdf(db: Session, quittance: Quittance) -> str:
    """Génère le PDF d'une quittance et retourne son chemin absolu. Régénère à
    chaque appel : sûr à ré-invoquer (ex: téléchargement d'une quittance dont le
    fichier a été perdu ou n'avait pas encore été généré)."""
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
    width, height = A4
    left = 22 * mm
    y = height - 30 * mm

    c.setFont("Helvetica-Bold", 18)
    c.drawString(left, y, "Quittance de loyer")
    y -= 10 * mm

    c.setFont("Helvetica", 10)
    c.drawString(left, y, f"Quittance n° {quittance.id} — générée le {_format_date(quittance.date_generation)}")
    y -= 14 * mm

    def line(label, value):
        nonlocal y
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left, y, label)
        c.setFont("Helvetica", 10)
        c.drawString(left + 55 * mm, y, str(value))
        y -= 7 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, "Bailleur")
    y -= 8 * mm
    line("Nom :", f"{proprietaire.prenom} {proprietaire.nom}" if proprietaire else "—")
    line("Email :", proprietaire.email if proprietaire else "—")
    y -= 4 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, "Locataire")
    y -= 8 * mm
    line("Nom :", f"{locataire.prenom} {locataire.nom}" if locataire else "—")
    line("Email :", locataire.email if locataire else "—")
    y -= 4 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, "Bien loué")
    y -= 8 * mm
    line("Désignation :", bien.designation or f"Bien #{bien.id}")
    line("Lot :", lot.reference or f"Lot #{lot.id}")
    y -= 4 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, "Paiement")
    y -= 8 * mm
    line("Période (échéance) :", _format_date(echeance.date_echeance))
    line("Montant payé :", _format_amount(paiement.montant))
    line("Mode de paiement :", MODE_PAIEMENT_LABELS.get(paiement.mode_paiement, "—"))
    line("Date de paiement :", _format_date(paiement.date_paiement))

    c.setFont("Helvetica-Oblique", 8)
    c.drawString(left, 15 * mm, "Document généré automatiquement par FADAA Locative.")

    c.showPage()
    c.save()

    return str(file_path)
