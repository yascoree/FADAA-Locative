"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function ProprietaireDashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="h4">Bonjour {user?.prenom} 👋</h1>
      <p className="text-muted">Bienvenue sur votre espace propriétaire.</p>

      <div className="card mt-4" style={{ maxWidth: 420 }}>
        <div className="card-body">
          <h2 className="h5 card-title">Gestion des permissions</h2>
          <p className="card-text text-muted">
            Invitez des gestionnaires et contrôlez précisément ce que chacun a le droit de faire sur vos biens.
          </p>
          <Link href="/backoffice/proprietaire/permissions" className="btn btn-primary">
            Gérer les permissions
          </Link>
        </div>
      </div>
    </div>
  );
}
