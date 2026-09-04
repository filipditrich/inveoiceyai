import {
  GeneratorLanding,
  generatorMetadata,
} from "@/components/generator/generator-landing";
import { GENERATOR_PATH_CS } from "@/lib/generator/href";

import type { Metadata } from "next";

export function generateMetadata(): Promise<Metadata> {
  return generatorMetadata(GENERATOR_PATH_CS, "cs");
}

export default function FakturaZdarmaPage() {
  return <GeneratorLanding />;
}
