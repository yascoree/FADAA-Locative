"use client";

import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { useLanguage } from "@/context/LanguageContext";

export default function ConditionsContent() {
  const { t } = useLanguage();
  const c = "legal.cgu.";

  return (
    <LegalPage title={t(`${c}pageTitle`)} updatedAt={t(`${c}updatedAt`)}>
      <p>{t(`${c}intro`)}</p>

      <h2>{t(`${c}s1Title`)}</h2>
      <p>{t(`${c}s1Intro`)}</p>
      <ul>
        {t(`${c}s1List`).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{t(`${c}s1Outro`)}</p>

      <h2>{t(`${c}s2Title`)}</h2>
      <p>{t(`${c}s2Intro`)}</p>
      <ul>
        {t(`${c}s2List`).map((item) => (
          <li key={item.role}>
            <strong>{item.role}</strong> — {item.text}
          </li>
        ))}
      </ul>
      <p>{t(`${c}s2Outro`)}</p>

      <h2>{t(`${c}s3Title`)}</h2>
      <p>{t(`${c}s3Intro`)}</p>
      <ul>
        {t(`${c}s3List`).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{t(`${c}s3Outro`)}</p>

      <h2>{t(`${c}s4Title`)}</h2>
      <p>{t(`${c}s4P1`)}</p>
      <p>{t(`${c}s4P2`)}</p>

      <h2>{t(`${c}s5Title`)}</h2>
      <p>{t(`${c}s5P1`)}</p>

      <h2>{t(`${c}s6Title`)}</h2>
      <p>{t(`${c}s6P1`)}</p>

      <h2>{t(`${c}s7Title`)}</h2>
      <p>{t(`${c}s7P1`)}</p>

      <h2>{t(`${c}s8Title`)}</h2>
      <p>{t(`${c}s8P1`)}</p>

      <h2>{t(`${c}s9Title`)}</h2>
      <p>{t(`${c}s9P1`)}</p>

      <h2>{t(`${c}s10Title`)}</h2>
      <p>
        {t(`${c}s10Before`)}
        <Link href="/front/contact">
          <strong>Contact</strong>
        </Link>
        {t(`${c}s10After`)}
      </p>
    </LegalPage>
  );
}
