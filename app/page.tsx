import type { Metadata } from "next";
import { EmissionReport } from "./EmissionReport";

export const metadata: Metadata = {
  title: "XDS Ten-Year Emission Explorer: A Code-Derived Analysis",
  description:
    "Explore ten protocol years of XDS issuance, monthly block rewards, generated supply, and the exact transition into perpetual tail emission.",
};

export default function Home() {
  return <EmissionReport />;
}
