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

type InvoiceVatBreakdownRowModel = Invoice["totals"]["vatBreakdown"][number];

export interface InvoicePdfAssets {
	readonly qrDataUrl?: string | null;
	/** must be Buffer for `@react-pdf/image`; Uint8Array is mis-routed as URL */
	readonly logo?: Buffer;
	readonly stamp?: Buffer;
	readonly signature?: Buffer;
}

const ACCENTS: Record<
	NonNullable<Invoice["customization"]>["accentColor"],
	string
> = {
	neutral: "#374151",
	blue: "#1e40af",
	green: "#166534",
	amber: "#b45309",
	rose: "#be123c",
	violet: "#6d28d9",
};

const styles = StyleSheet.create({
	page: {
		fontFamily: "DejaVu Sans",
		fontSize: 9,
		paddingTop: 40,
		paddingBottom: 40,
		paddingHorizontal: 40,
		color: "#111827",
	},
	band: {
		height: 4,
		marginHorizontal: -40,
		marginTop: -40,
		marginBottom: 14,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	headerLeft: {
		maxWidth: "58%",
	},
	logoBox: {
		width: 120,
		height: 52,
		marginBottom: 4,
		objectFit: "contain",
		objectPosition: "right top",
	},
	h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
	h2: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4 },
	muted: { fontSize: 8, color: "#4b5563" },
	address: { marginTop: 2, lineHeight: 1.35 },
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		paddingVertical: 4,
		fontWeight: 700,
		fontSize: 8,
	},
	rowLine: {
		flexDirection: "row",
		borderBottomWidth: 0.5,
		borderBottomColor: "#f3f4f6",
		paddingVertical: 3,
		fontSize: 8,
	},
	cellDesc: { width: "40%" },
	cellQty: { width: "8%", textAlign: "right" },
	cellUnit: { width: "8%" },
	cellUprice: { width: "13%", textAlign: "right" },
	cellRate: { width: "10%", textAlign: "right" },
	cellNet: { width: "13%", textAlign: "right" },
	cellVatAmt: { width: "8%", textAlign: "right" },
	totalsBlock: {
		marginTop: 10,
		alignSelf: "flex-end",
		width: 220,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 2,
	},
	totalStrong: {
		fontWeight: 700,
		fontSize: 11,
		marginTop: 4,
		paddingTop: 4,
		borderTopWidth: 1,
		borderTopColor: "#111827",
	},
	paymentBox: {
		marginTop: 16,
		padding: 10,
		backgroundColor: "#f9fafb",
		borderRadius: 4,
	},
	qr: { width: 120, height: 120 },
	footerLegal: {
		marginTop: 12,
		fontSize: 7,
		color: "#6b7280",
		lineHeight: 1.35,
	},
	stampSigRow: {
		marginTop: 18,
		flexDirection: "row",
		justifyContent: "flex-end",
	},
	stampSigBox: {
		marginLeft: 16,
	},
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

function docTitle(inv: Invoice): string {
	switch (inv.meta.docType) {
		case "invoice":
			return "Faktura – daňový doklad";
		case "credit_note":
			return "Dobropis";
		case "proforma":
			return "Proforma faktura";
		case "advance":
			return "Zálohová faktura";
		default: {
			const _never: never = inv.meta.docType;
			return _never;
		}
	}
}

export interface InvoicePdfDocumentProps {
	readonly invoice: Invoice;
	readonly assets: InvoicePdfAssets;
}

/** Wrapper so React `key` is accepted by TS (react-pdf `ViewProps` omits `key`). */
function PdfInvoiceLineRow({ item }: Readonly<{ item: InvoiceItem }>) {
	return (
		<View style={styles.rowLine}>
			<Text style={styles.cellDesc}>{item.description}</Text>
			<Text style={styles.cellQty}>{fmtQty(item.quantity)}</Text>
			<Text style={styles.cellUnit}>{item.unit}</Text>
			<Text style={styles.cellUprice}>
				{fmtMoneyCz(item.unitPriceWithoutVat)}
			</Text>
			<Text style={styles.cellRate}>{String(item.vatRate)}</Text>
			<Text style={styles.cellNet}>{fmtMoneyCz(item.lineSubtotal)}</Text>
			<Text style={styles.cellVatAmt}>{fmtMoneyCz(item.lineVat)}</Text>
		</View>
	);
}

/** @see PdfInvoiceLineRow */
function PdfVatBreakdownRow({
	row,
}: Readonly<{ row: InvoiceVatBreakdownRowModel }>) {
	return (
		<View style={styles.rowLine}>
			<Text style={{ width: "25%" }}>{String(row.rate)}</Text>
			<Text style={{ width: "25%", textAlign: "right" }}>
				{fmtMoneyCz(row.base)}
			</Text>
			<Text style={{ width: "25%", textAlign: "right" }}>
				{fmtMoneyCz(row.vat)}
			</Text>
			<Text style={{ width: "25%", textAlign: "right" }}>
				{fmtMoneyCz(row.base + row.vat)}
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
	const accent = ACCENTS[customization.accentColor];

	const showDuzp =
		inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";

	const showRecap =
		inv.issuer.vatPayer
		&& inv.vat.mode !== "reverse_charge"
		&& inv.totals.vatBreakdown.length > 0;

	const sortedItems = [...inv.items].sort((a, b) => a.position - b.position);

	return (
		<Document title={`Faktura ${inv.meta.number}`} creator="Invoicey">
			<Page size="A4" style={styles.page}>
				<View style={[styles.band, { backgroundColor: accent }]} />

				<View style={styles.row}>
					<View style={styles.headerLeft}>
						{assets.logo ? (
							<Image style={styles.logoBox} src={assets.logo} />
						) : null}
						<Text style={styles.h1}>{inv.issuer.name}</Text>
						<Text style={styles.address}>
							{inv.issuer.address.street}
							{", "}
							{inv.issuer.address.zip}
							{", "}
							{inv.issuer.address.city}
						</Text>
						<Text style={[styles.address, styles.muted]}>
							IČO{" "}
							{inv.issuer.ico}
							{inv.issuer.vatPayer && inv.issuer.dic
								? ` · DIČ ${inv.issuer.dic}`
								: ""}
						</Text>
						{inv.issuer.registryNote ? (
							<Text style={[styles.footerLegal, { marginTop: 4 }]}>
								{inv.issuer.registryNote}
							</Text>
						) : null}
					</View>
					<View>
						<Text style={[styles.h1, { textAlign: "right" }]}>
							{docTitle(inv)}
						</Text>
						<Text style={{ textAlign: "right", fontWeight: 700 }}>
							{inv.meta.number}
						</Text>
						<Text style={[styles.address, styles.muted, { textAlign: "right" }]}>
							{"Datum vystavení: "}
							{inv.meta.issueDate}
						</Text>
						<Text style={[styles.address, styles.muted, { textAlign: "right" }]}>
							{"Datum splatnosti: "}
							{inv.meta.dueDate}
						</Text>
						{showDuzp ? (
							<Text
								style={[styles.address, styles.muted, { textAlign: "right" }]}
							>
								{"Datum zdanitelného plnění: "}
								{inv.meta.duzp}
							</Text>
						) : null}
						{inv.meta.docType === "credit_note"
						&& inv.meta.correctedInvoiceNumber ? (
							<Text
								style={[styles.address, styles.muted, { textAlign: "right" }]}
							>
								{"Opravuje doklad č.: "}
								{inv.meta.correctedInvoiceNumber}
							</Text>
						) : null}
					</View>
				</View>

				<Text style={styles.h2}>Odběratel</Text>
				<Text style={{ fontWeight: 700 }}>{inv.client.name}</Text>
				<Text style={styles.address}>
					{inv.client.address.street}
					{", "}
					{inv.client.address.zip}
					{", "}
					{inv.client.address.city}
					{" · "}
					{inv.client.address.country}
				</Text>
				{inv.client.ico ? (
					<Text style={styles.muted}>IČO {inv.client.ico}</Text>
				) : null}
				{inv.client.dic ? (
					<Text style={styles.muted}>DIČ / VAT {inv.client.dic}</Text>
				) : null}
				{inv.client.contactEmail ? (
					<Text style={styles.muted}>{inv.client.contactEmail}</Text>
				) : null}

				<Text style={styles.h2}>Položky</Text>
				<View style={styles.tableHeader}>
					<Text style={styles.cellDesc}>Popis</Text>
					<Text style={styles.cellQty}>Množ.</Text>
					<Text style={styles.cellUnit}>J.</Text>
					<Text style={styles.cellUprice}>Cena bez DPH</Text>
					<Text style={styles.cellRate}>sazba %</Text>
					<Text style={styles.cellNet}>bez DPH</Text>
					<Text style={styles.cellVatAmt}>DPH</Text>
				</View>
				{sortedItems.map((it) => (
					<PdfInvoiceLineRow key={it.position} item={it} />
				))}

				<View style={styles.totalsBlock}>
					<View style={styles.totalRow}>
						<Text>Celkem bez DPH</Text>
						<Text>{fmtMoneyCz(inv.totals.subtotal)}</Text>
					</View>
					<View style={styles.totalRow}>
						<Text>DPH celkem</Text>
						<Text>{fmtMoneyCz(inv.totals.vatTotal)}</Text>
					</View>
					<View style={[styles.totalRow, styles.totalStrong]}>
						<Text>Celkem k úhradě ({inv.meta.currency})</Text>
						<Text>{fmtMoneyCz(inv.totals.total)}</Text>
					</View>
				</View>

				{!inv.issuer.vatPayer ? (
					<Text style={{ marginTop: 8 }}>Nejsem plátce DPH.</Text>
				) : null}

				{inv.vat.mode === "reverse_charge" ? (
					<View style={{ marginTop: 8 }}>
						<Text style={{ fontWeight: 700 }}>
							Přenesená daňová povinnost
						</Text>
						<Text style={[styles.footerLegal, { color: "#111827", fontSize: 9 }]}>
							{inv.vat.legalNote
								?? "Daň odvede zákazník dle § 92a zákona č. 235/2004 Sb."}
						</Text>
					</View>
				) : null}

				{inv.vat.mode === "oss" ? (
					<View style={{ marginTop: 8 }}>
						<Text style={{ fontWeight: 700 }}>Režim OSS</Text>
						<Text style={[styles.footerLegal, { color: "#111827", fontSize: 9 }]}>
							{inv.vat.legalNote
								?? "Zdaněno v režimu jednoho registračního místa OSS (země příjemce)."}
						</Text>
					</View>
				) : null}

				{showRecap ? (
					<>
						<Text style={styles.h2}>Rekapitulace DPH</Text>
						<View style={styles.tableHeader}>
							<Text style={{ width: "25%" }}>%</Text>
							<Text style={{ width: "25%", textAlign: "right" }}>základ</Text>
							<Text style={{ width: "25%", textAlign: "right" }}>DPH</Text>
							<Text style={{ width: "25%", textAlign: "right" }}>
								se základ (+ DPH)
							</Text>
						</View>
						{inv.totals.vatBreakdown.map((row) => (
							<PdfVatBreakdownRow key={row.rate} row={row} />
						))}
					</>
				) : null}

				<View style={styles.paymentBox}>
					<Text style={{ fontWeight: 700, marginBottom: 4 }}>Platba</Text>
					{inv.payment.method === "transfer" && inv.payment.bankAccount ? (
						<>
							<Text>Převod na účet</Text>
							<Text>
								Účet: {inv.payment.bankAccount.accountNumber}
								{" · IBAN "}
								{inv.payment.bankAccount.iban}
							</Text>
							{inv.payment.bankAccount.bic ? (
								<Text>BIC {inv.payment.bankAccount.bic}</Text>
							) : null}
							<View style={[styles.row, { alignItems: "flex-start", marginTop: 6 }]}>
								<View style={{ flexGrow: 1 }}>
									{inv.payment.variableSymbol ? (
										<Text style={styles.muted}>
											Variabilní symbol: {inv.payment.variableSymbol}
										</Text>
									) : null}
									{inv.payment.constantSymbol ? (
										<Text style={styles.muted}>
											Konstantní symbol: {inv.payment.constantSymbol}
										</Text>
									) : null}
									{inv.payment.specificSymbol ? (
										<Text style={styles.muted}>
											Specifický symbol: {inv.payment.specificSymbol}
										</Text>
									) : null}
								</View>
								{assets.qrDataUrl ? (
									<Image style={styles.qr} src={assets.qrDataUrl} />
								) : null}
							</View>
						</>
					) : inv.payment.method === "cash" ? (
						<Text>Platba v hotovosti</Text>
					) : (
						<Text>Platba kartou</Text>
					)}
				</View>

				{inv.notes ? (
					<View style={{ marginTop: 10 }}>
						<Text style={{ fontWeight: 700 }}>Poznámka</Text>
						<Text style={styles.address}>{inv.notes}</Text>
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
			</Page>
		</Document>
	);
}
