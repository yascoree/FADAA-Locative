import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className="container mt-5">
      <h1>Gestion Locative</h1>
      <p>Bienvenue dans mon application de gestion locative.</p>

      <button className="btn btn-primary">
        Accéder au Dashboard
      </button>
    </div>
  );
}
