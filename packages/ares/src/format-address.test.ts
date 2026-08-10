import { describe, expect, it } from "vitest";

import {
	mapSidloToClientAddressParts,
	parseCzAddressText,
} from "./format-address";

describe("parseCzAddressText", () => {
	it("parses street, city, pure zip segments", () => {
		expect(parseCzAddressText("Opletalova 1410, Praha 1, 110 00")).toEqual({
			street: "Opletalova 1410",
			city: "Praha 1",
			zip: "110 00",
			country: "CZ",
		});
	});

	it("parses ARES textovaAdresa with zip+city segment", () => {
		expect(
			parseCzAddressText(
				"Opletalova 1525/39, Nové Město, 11000 Praha 1",
			),
		).toEqual({
			street: "Opletalova 1525/39",
			city: "Praha 1",
			zip: "110 00",
			country: "CZ",
		});
	});
});

describe("mapSidloToClientAddressParts", () => {
	it("prefers structured sidlo fields", () => {
		expect(
			mapSidloToClientAddressParts({
				kodStatu: "CZ",
				nazevUlice: "Opletalova",
				cisloDomovni: 1525,
				cisloOrientacni: 39,
				nazevObce: "Praha",
				psc: 11000,
				textovaAdresa: "Opletalova 1525/39, Nové Město, 11000 Praha 1",
			}),
		).toEqual({
			street: "Opletalova 1525/39",
			city: "Praha",
			zip: "110 00",
			country: "CZ",
		});
	});

	it("falls back to textovaAdresa when structured fields missing", () => {
		expect(
			mapSidloToClientAddressParts({
				textovaAdresa: "Opletalova 1410, Praha 1, 110 00",
			}),
		).toEqual({
			street: "Opletalova 1410",
			city: "Praha 1",
			zip: "110 00",
			country: "CZ",
		});
	});
});
