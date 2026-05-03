/** @jsxImportSource react */
import {
	Document,
	Image,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import React from "react";

import type { Invoice, InvoiceItem } from "../schema";

/** PDF uses fixed neutral styling (no violet product accents). */
const LABEL = "#333333";
const MUTED = "#6b7280";
const MUTED_LIGHT = "#9ca3af";
const LINE = "#e5e7eb";
const BAR_BG = "#f3f4f6";
const BADGE_ISSUED_BG = "#fef9c3";
const BADGE_ISSUED_FG = "#713f12";

type InvoiceVatBreakdownRowModel = Invoice["totals"]["vatBreakdown"][number];

export interface InvoicePdfAssets {
	readonly qrDataUrl?: string | null;
	/** must be Buffer for `@react-pdf/image`; Uint8Array is mis-routed as URL */
	readonly logo?: Buffer;
	readonly stamp?: Buffer;
	readonly signature?: Buffer;
}

const styles = StyleSheet.create({
	page: {
		fontFamily: "DejaVu Sans",
		fontSize: 9,
		paddingTop: 36,
		paddingBottom: 36,
		paddingHorizontal: 42,
		color: "#171717",
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	headerTopLeft: {
		width: "42%",
		minHeight: 0,
	},
	logoImg: {
		maxHeight: 56,
		width: 140,
		objectFit: "contain",
		objectPosition: "left top",
	},
	headerTopRight: {
		width: "52%",
		alignItems: "flex-end",
	},
	docKind: {
		fontSize: 7.5,
		color: MUTED_LIGHT,
		fontWeight: 700,
		letterSpacing: 0.6,
		marginBottom: 4,
	},
	invoiceNumber: {
		fontSize: 22,
		fontWeight: 700,
		color: "#0a0a0a",
		lineHeight: 1.15,
	},
	statusBadge: {
		marginTop: 8,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 5,
		backgroundColor: BADGE_ISSUED_BG,
	},
	statusBadgeText: {
		fontSize: 7.5,
		fontWeight: 700,
		color: BADGE_ISSUED_FG,
		letterSpacing: 0.3,
	},
	partiesRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 22,
	},
	partyCol: {
		width: "47%",
	},
	sectionLabel: {
		fontSize: 7.5,
		fontWeight: 700,
		color: LABEL,
		letterSpacing: 0.8,
		marginBottom: 6,
	},
	partyName: {
		fontSize: 10,
		fontWeight: 700,
		marginBottom: 4,
	},
	partyMuted: {
		fontSize: 8,
		color: MUTED,
		lineHeight: 1.38,
	},
	dateBar: {
		marginTop: 18,
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: BAR_BG,
		borderRadius: 4,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	dateCell: {
		flex: 1,
		alignItems: "center",
		paddingHorizontal: 4,
	},
	dateLabel: {
		fontSize: 6.8,
		color: MUTED_LIGHT,
		fontWeight: 700,
		marginBottom: 4,
		letterSpacing: 0.4,
		textAlign: "center",
	},
	dateValue: {
		fontSize: 9,
		fontWeight: 700,
		color: "#0a0a0a",
		textAlign: "center",
	},
	tableWrap: {
		marginTop: 18,
	},
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: LINE,
		paddingBottom: 6,
		paddingTop: 2,
	},
	th: {
		fontSize: 7.5,
		fontWeight: 700,
		color: MUTED,
		letterSpacing: 0.2,
	},
	thDesc: { width: "34%" },
	thQty: { width: "8%", textAlign: "right" },
	thUnit: { width: "8%" },
	thUnitPx: { width: "13%", textAlign: "right" },
	thVat: { width: "11%", textAlign: "center" },
	thTot: { width: "26%", textAlign: "right" },
	lineRow: {
		flexDirection: "row",
		borderBottomWidth: 0.5,
		borderBottomColor: "#f3f4f6",
		paddingVertical: 8,
		alignItems: "flex-start",
	},
	descCol: { width: "34%", paddingRight: 6 },
	lineTitle: { fontSize: 8.5, fontWeight: 700 },
	lineSub: { fontSize: 7.5, color: MUTED, marginTop: 2, lineHeight: 1.35 },
	cellRight: { textAlign: "right" as const },
	vatPill: {
		alignSelf: "center",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		backgroundColor: "#e5e7eb",
	},
	vatPillText: { fontSize: 7, fontWeight: 700, color: LABEL },
	totalsBlock: {
		marginTop: 14,
		alignSelf: "flex-end",
		width: 240,
	},
	totalLine: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 4,
		paddingHorizontal: 2,
	},
	totalLineMuted: { fontSize: 8.5, color: MUTED },
	totalGrand: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: LABEL,
	},
	totalGrandLabel: { fontSize: 10.5, fontWeight: 700 },
	totalGrandValue: { fontSize: 14, fontWeight: 700 },
	legalMini: {
		marginTop: 10,
		fontSize: 8,
		lineHeight: 1.38,
	},
	paymentOuter: {
		marginTop: 18,
		borderWidth: 1,
		borderColor: LINE,
		borderRadius: 4,
		padding: 12,
		flexDirection: "row",
		alignItems: "flex-start",
	},
	payTitle: {
		fontSize: 7.5,
		fontWeight: 700,
		color: LABEL,
		letterSpacing: 0.8,
		marginBottom: 8,
	},
	payMuted: { fontSize: 8, color: MUTED, marginTop: 2 },
	payBold: { fontSize: 9, fontWeight: 700, marginTop: 4 },
	qr: {
		width: 112,
		height: 112,
		marginLeft: 14,
	},
	footerRow: {
		marginTop: 16,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		borderTopWidth: 0.5,
		borderTopColor: LINE,
		paddingTop: 10,
	},
	footerSmall: {
		fontSize: 7,
		color: MUTED,
		lineHeight: 1.4,
		maxWidth: "58%",
	},
	footerBrand: { fontSize: 7.5, color: MUTED },
	footerBrandStrong: { fontWeight: 700, color: LABEL },
	stampSigRow: {
		marginTop: 16,
		flexDirection: "row",
		justifyContent: "flex-end",
	},
	stampSigBox: { marginLeft: 16 },
	stampSig: {
		width: 120,
		height: 48,
		objectFit: "contain",
		objectPosition: "bottom",
	},
});

function fmtMoneyCz(n: number): string {
	return new Intl.NumberFormat("cs-CZ", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(n);
}

function fmtQty(n: number): string {
	const s = n.toLocaleString("cs-CZ", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 3,
	});
	return s.replaceAll(",", " ");
}

function formatIbanDisplay(iban: string): string {
	const clean = iban.replace(/\s/g, "");
	return clean.replace(/(.{4})/g, "$1 ").trim();
}

function docKindUpper(inv: Invoice): string {
	switch (inv.meta.docType) {
		case "invoice":
			return "DAŇOVÝ DOKLAD";
		case "credit_note":
			return "DOBROPIS";
		case "proforma":
			return "PROFORMA FAKTURA";
		case "advance":
			return "ZÁLOHOVÁ FAKTURA";
		default: {
			const _never: never = inv.meta.docType;
			return _never;
		}
	}
}

function statusBadgeText(inv: Invoice): string {
	switch (inv.meta.docType) {
		case "proforma":
			return "PROFORMA";
		case "credit_note":
			return "VYDÁN";
		default:
			return "VYDÁNA";
	}
}

export interface InvoicePdfDocumentProps {
	readonly invoice: Invoice;
	readonly assets: InvoicePdfAssets;
}

function splitDescription(raw: string): { title: string; detail?: string } {
	const idx = raw.indexOf("\n");
	if (idx === -1) {
		return { title: raw };
	}
	const title = raw.slice(0, idx).trim();
	const rest = raw.slice(idx + 1).trim();
	return { title: title.length > 0 ? title : raw, detail: rest || undefined };
}

/** Wrapper so React `key` is accepted by TS (react-pdf `ViewProps` omits `key`). */
function PdfInvoiceLineRow({ item }: Readonly<{ item: InvoiceItem }>) {
	const { title, detail } = splitDescription(item.description);
	return (
		<View style={styles.lineRow}>
			<View style={styles.descCol}>
				<Text style={styles.lineTitle}>{title}</Text>
				{detail ? <Text style={styles.lineSub}>{detail}</Text> : null}
			</View>
			<Text style={[styles.thQty, { width: "8%" }, styles.cellRight]}>
				{fmtQty(item.quantity)}
			</Text>
			<Text style={{ width: "8%", fontSize: 8.5 }}>{item.unit}</Text>
			<Text style={[styles.thUnitPx, { fontSize: 8.5 }, styles.cellRight]}>
				{fmtMoneyCz(item.unitPriceWithoutVat)}
			</Text>
			<View style={{ width: "11%", alignItems: "center" }}>
				<View style={styles.vatPill}>
					<Text style={styles.vatPillText}>{String(item.vatRate)}%</Text>
				</View>
			</View>
			<Text
				style={[
					styles.thTot,
					{ fontSize: 8.5, fontWeight: 700 },
					styles.cellRight,
				]}
			>
				{fmtMoneyCz(item.lineTotal)}
			</Text>
		</View>
	);
}

export function InvoicePdfDocument({
	invoice: inv,
	assets,
}: InvoicePdfDocumentProps) {
	const customization = inv.customization ?? {
		accentColor: "neutral",
		showStamp: false,
		showSignature: false,
	};

	const showDuzp =
		inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";

	const showRecapDetail =
		inv.issuer.vatPayer
		&& inv.vat.mode === "regular"
		&& inv.totals.vatBreakdown.length > 0
		&& inv.totals.vatTotal > 0;

	const sortedItems = [...inv.items].sort((a, b) => a.position - b.position);

	const issuerLines = (
		<>
			<Text style={styles.partyMuted}>
				{inv.issuer.address.street}
				{"\n"}
				{inv.issuer.address.zip}
				{", "}
				{inv.issuer.address.city}
				{"\n"}
				Česká republika
				{"\n"}
				{"IČO "}
				{inv.issuer.ico}
				{inv.issuer.vatPayer && inv.issuer.dic
					? ` · DIČ ${inv.issuer.dic}`
					: ""}
				{!inv.issuer.vatPayer ? "\nNeplátce DPH" : ""}
			</Text>
			{inv.issuer.registryNote ? (
				<Text style={[styles.partyMuted, { marginTop: 4 }]}>
					{inv.issuer.registryNote}
				</Text>
			) : null}
		</>
	);

	const clientLines = (
		<>
			<Text style={styles.partyMuted}>
				{inv.client.address.street}
				{"\n"}
				{inv.client.address.zip}
				{", "}
				{inv.client.address.city}
				{"\n"}
				{inv.client.address.country}
				{inv.client.ico ? `\nIČO ${inv.client.ico}` : ""}
				{inv.client.dic ? `\nDIČ ${inv.client.dic}` : ""}
			</Text>
			{inv.client.contactEmail ? (
				<Text style={[styles.partyMuted, { marginTop: 4 }]}>
					{inv.client.contactEmail}
				</Text>
			) : null}
		</>
	);

	const footerIssuerOneLiner = `${inv.issuer.name} · ${inv.issuer.address.zip} ${inv.issuer.address.city} · IČO ${inv.issuer.ico}`;

	return (
		<Document title={`Faktura ${inv.meta.number}`} creator="Invoicey">
			<Page size="A4" style={styles.page}>
				<View style={styles.row}>
					<View style={styles.headerTopLeft}>
						{assets.logo ? (
							<Image style={styles.logoImg} src={assets.logo} />
						) : null}
					</View>
					<View style={styles.headerTopRight}>
						<Text style={styles.docKind}>{docKindUpper(inv)}</Text>
						<Text style={styles.invoiceNumber}>{inv.meta.number}</Text>
						<View style={styles.statusBadge}>
							<Text style={styles.statusBadgeText}>
								{statusBadgeText(inv)}
							</Text>
						</View>
					</View>
				</View>

				<View style={styles.partiesRow}>
					<View style={styles.partyCol}>
						<Text style={styles.sectionLabel}>DODAVATEL</Text>
						<Text style={styles.partyName}>{inv.issuer.name}</Text>
						{issuerLines}
					</View>
					<View style={styles.partyCol}>
						<Text style={styles.sectionLabel}>ODBĚRATEL</Text>
						<Text style={styles.partyName}>{inv.client.name}</Text>
						{clientLines}
					</View>
				</View>

				<View style={styles.dateBar}>
					<View style={styles.dateCell}>
						<Text style={styles.dateLabel}>DATUM VYSTAVENÍ</Text>
						<Text style={styles.dateValue}>{inv.meta.issueDate}</Text>
					</View>
					<View style={styles.dateCell}>
						<Text style={styles.dateLabel}>DUZP</Text>
						<Text style={styles.dateValue}>
							{showDuzp ? inv.meta.duzp : "—"}
						</Text>
					</View>
					<View style={styles.dateCell}>
						<Text style={styles.dateLabel}>DATUM SPLATNOSTI</Text>
						<Text style={styles.dateValue}>{inv.meta.dueDate}</Text>
					</View>
					<View style={styles.dateCell}>
						<Text style={styles.dateLabel}>VARIABILNÍ SYMBOL</Text>
						<Text style={styles.dateValue}>
							{inv.payment.variableSymbol ?? "—"}
						</Text>
					</View>
				</View>

				{inv.meta.docType === "credit_note" && inv.meta.correctedInvoiceNumber ? (
					<Text style={[styles.partyMuted, { marginTop: 8 }]}>
						Opravuje doklad č.: {inv.meta.correctedInvoiceNumber}
					</Text>
				) : null}

				<View style={styles.tableWrap}>
					<View style={styles.tableHeader}>
						<Text style={[styles.th, styles.thDesc]}>POPIS</Text>
						<Text style={[styles.th, styles.thQty, styles.cellRight]}>MN.</Text>
						<Text style={[styles.th, styles.thUnit]}>J.</Text>
						<Text style={[styles.th, styles.thUnitPx, styles.cellRight]}>
							JEDN. CENA
						</Text>
						<Text style={[styles.th, styles.thVat]}>DPH</Text>
						<Text style={[styles.th, styles.thTot, styles.cellRight]}>
							CELKEM
						</Text>
					</View>
					{sortedItems.map((it) => (
						<PdfInvoiceLineRow key={it.position} item={it} />
					))}
				</View>

				<View style={styles.totalsBlock}>
					{inv.issuer.vatPayer ? (
						<>
							<View style={styles.totalLine}>
								<Text style={styles.totalLineMuted}>Základ daně</Text>
								<Text style={styles.totalLineMuted}>
									{fmtMoneyCz(inv.totals.subtotal)} Kč
								</Text>
							</View>
							{showRecapDetail
								? inv.totals.vatBreakdown.map((row) => (
										<VatFoldRow key={`${row.rate}`} row={row} />
									))
								: null}
							{!showRecapDetail && inv.issuer.vatPayer ? (
								<View style={styles.totalLine}>
									<Text style={styles.totalLineMuted}>DPH</Text>
									<Text style={styles.totalLineMuted}>
										{fmtMoneyCz(inv.totals.vatTotal)} Kč
									</Text>
								</View>
							) : null}
						</>
					) : null}

					<View style={styles.totalGrand}>
						<Text style={styles.totalGrandLabel}>K úhradě</Text>
						<Text style={styles.totalGrandValue}>
							{fmtMoneyCz(inv.totals.total)} Kč
						</Text>
					</View>
				</View>

				{!inv.issuer.vatPayer ? (
					<Text style={styles.legalMini}>Nejsem plátce DPH.</Text>
				) : null}

				{inv.vat.mode === "reverse_charge" ? (
					<View style={{ marginTop: 8 }}>
						<Text style={{ fontWeight: 700, fontSize: 9 }}>
							Přenesená daňová povinnost
						</Text>
						<Text style={styles.legalMini}>
							{inv.vat.legalNote
								?? "Daň odvede zákazník dle § 92a zákona č. 235/2004 Sb."}
						</Text>
					</View>
				) : null}

				{inv.vat.mode === "oss" ? (
					<View style={{ marginTop: 8 }}>
						<Text style={{ fontWeight: 700, fontSize: 9 }}>Režim OSS</Text>
						<Text style={styles.legalMini}>
							{inv.vat.legalNote
								?? "Zdaněno v režimu jednoho registračního místa OSS (země příjemce)."}
						</Text>
					</View>
				) : null}

				<View style={styles.paymentOuter}>
					<View style={{ flexGrow: 1, flexShrink: 1 }}>
						<Text style={styles.payTitle}>PLATEBNÍ ÚDAJE</Text>
						{inv.payment.method === "transfer" && inv.payment.bankAccount ? (
							<>
								<Text style={styles.payBold}>
									Účet: {inv.payment.bankAccount.accountNumber}
								</Text>
								<Text style={styles.payMuted}>
									IBAN {formatIbanDisplay(inv.payment.bankAccount.iban)}
								</Text>
								{inv.payment.bankAccount.bic ? (
									<Text style={styles.payMuted}>
										SWIFT {inv.payment.bankAccount.bic}
									</Text>
								) : null}
								{inv.payment.variableSymbol ? (
									<Text style={styles.payMuted}>
										Variabilní symbol: {inv.payment.variableSymbol}
									</Text>
								) : null}
								{inv.payment.constantSymbol ? (
									<Text style={styles.payMuted}>
										Konstantní symbol: {inv.payment.constantSymbol}
									</Text>
								) : null}
								{inv.payment.specificSymbol ? (
									<Text style={styles.payMuted}>
										Specifický symbol: {inv.payment.specificSymbol}
									</Text>
								) : null}
								<Text style={[styles.payMuted, { marginTop: 6 }]}>
									Datum splatnosti: {inv.meta.dueDate}
								</Text>
							</>
						) : inv.payment.method === "cash" ? (
							<Text style={styles.payBold}>Platba v hotovosti</Text>
						) : (
							<Text style={styles.payBold}>Platba kartou</Text>
						)}
					</View>
					{assets.qrDataUrl ? (
						<Image style={styles.qr} src={assets.qrDataUrl} />
					) : null}
				</View>

				{inv.notes ? (
					<View style={{ marginTop: 10 }}>
						<Text style={{ fontWeight: 700, fontSize: 9 }}>Poznámka</Text>
						<Text style={styles.legalMini}>{inv.notes}</Text>
					</View>
				) : null}

				{(customization.showStamp && assets.stamp)
				|| (customization.showSignature && assets.signature) ? (
					<View style={styles.stampSigRow}>
						{customization.showStamp && assets.stamp ? (
							<Image style={styles.stampSig} src={assets.stamp} />
						) : (
							<View />
						)}
						{customization.showSignature && assets.signature ? (
							<View style={styles.stampSigBox}>
								<Image style={styles.stampSig} src={assets.signature} />
							</View>
						) : null}
					</View>
				) : null}

				<View style={styles.footerRow} fixed>
					<Text style={styles.footerSmall}>{footerIssuerOneLiner}</Text>
					<Text style={styles.footerBrand}>
						Vystaveno přes <Text style={styles.footerBrandStrong}>Invoicey</Text>
					</Text>
				</View>
			</Page>
		</Document>
	);
}

function VatFoldRow({
	row,
}: Readonly<{ row: InvoiceVatBreakdownRowModel }>) {
	return (
		<View style={styles.totalLine}>
			<Text style={styles.totalLineMuted}>DPH {String(row.rate)}%</Text>
			<Text style={styles.totalLineMuted}>{fmtMoneyCz(row.vat)} Kč</Text>
		</View>
	);
}

