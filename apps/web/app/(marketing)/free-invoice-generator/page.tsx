import {
  GeneratorLanding,
  generatorMetadata,
} from "@/components/generator/generator-landing";
import { GENERATOR_PATH_EN } from "@/lib/generator/href";

import type { Metadata } from "next";

export function generateMetadata(): Promise<Metadata> {
  return generatorMetadata(GENERATOR_PATH_EN, "en");
}

export default function FreeInvoiceGeneratorPage() {
  return <GeneratorLanding />;
}
