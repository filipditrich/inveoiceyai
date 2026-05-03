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

const F_SANS = "Inter";

const BODY = "#0a0a0a";
const MUTED = "#4b5563";
const LINE = "#e5e7eb";

type InvoiceVatBreakdownRowModel = Invoice["totals"]["vatBreakdown"][number];

export interface InvoicePdfAssets {
	readonly qrDataUrl?: string | null;
	readonly logo?: Buffer;
	readonly stamp?: Buffer;
	readonly signature?: Buffer;
}

const styles = StyleSheet.create({
	page: {
		flexDirection: "column",
		fontFamily: F_SANS,
		fontSize: 8.5,
		paddingTop: 32,
		paddingHorizontal: 42,
		paddingBottom: 52,
		color: BODY,
	},
	mainColumn: {
		flexDirection: "column",
		flexGrow: 1,
		width: "100%",
	},
	/** Full header + parties, hairline before table body */
	upperSheet: {
		width: "100%",
		paddingBottom: 14,
		borderBottomWidth: 0,
		borderBottomColor: LINE,
		marginBottom: 10,
	},
	upperTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		width: "100%",
	},
	upperTopCol: {
		width: "48%",
	},
	heroMin: {
		width: "100%",
		minHeight: 78,
		justifyContent: "flex-start",
	},
	logoImg: {
		maxHeight: 52,
		width: 140,
		objectFit: "contain",
		objectPosition: "left top",
	},
	/** Thin rule over title column (Pokojovky ref) */
	titleColRule: {
		width: "100%",
		borderBottomWidth: 1,
		borderBottomColor: LINE,
		marginBottom: 8,
	},
	invoiceTitle: {
		fontFamily: F_SANS,
		fontSize: 15,
		fontWeight: 700,
		color: BODY,
		lineHeight: 1.08,
	},
	docKindMicro: {
		fontFamily: F_SANS,
		fontSize: 6.75,
		fontWeight: 400,
		color: MUTED,
		marginTop: 4,
	},
	partyPairRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		width: "100%",
		marginTop: 10,
	},
	partyCol: {
		width: "48%",
		alignItems: "stretch",
	},
	sectionHairShort: {
		width: 44,
		borderBottomWidth: 1,
		borderBottomColor: LINE,
		marginBottom: 6,
	},
	sectionCaps: {
		fontFamily: F_SANS,
		fontSize: 6.5,
		fontWeight: 400,
		color: MUTED,
		marginBottom: 4,
	},
	partyName: {
		fontFamily: F_SANS,
		fontSize: 10,
		fontWeight: 700,
		color: BODY,
		marginBottom: 3,
	},
	partyAddr: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: MUTED,
		lineHeight: 1.3,
	},
	partyAddrTight: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: MUTED,
		lineHeight: 1.3,
		marginTop: 1,
	},
	kvRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginTop: 3,
		width: "100%",
	},
	kvRowFirst: { marginTop: 0 },
	kvKeyCol: {
		width: "44%",
		paddingRight: 6,
	},
	kvKey: {
		fontFamily: F_SANS,
		fontSize: 7.5,
		fontWeight: 400,
		color: MUTED,
	},
	kvValCol: {
		width: "56%",
	},
	paymentKvKeyCol: {
		width: "32%",
		paddingRight: 8,
	},
	paymentKvValCol: {
		width: "68%",
	},
	kvVal: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: BODY,
		textAlign: "right",
	},
	kvBlock: { width: "100%", marginTop: 6 },
	kvBlockGap: { width: "100%", marginTop: 8 },
	paymentDetailKv: { marginTop: 0, width: "100%", alignSelf: "stretch" },
	tableWrap: { marginTop: 4 },
	tableHeadRow: {
		flexDirection: "row",
		borderBottomWidth: 0.5,
		borderBottomColor: LINE,
		paddingBottom: 4,
		paddingTop: 2,
	},
	th: {
		fontFamily: F_SANS,
		fontSize: 6.5,
		fontWeight: 400,
		color: MUTED,
	},
	thDesc: { width: "30%" },
	thQty: { width: "9%", textAlign: "right", paddingRight: 4 },
	thUnit: { width: "8%" },
	thUnitPx: { width: "16%", textAlign: "right" },
	thVat: { width: "12%", textAlign: "right", paddingRight: 4 },
	thTot: { width: "25%", textAlign: "right" },
	lineRow: {
		flexDirection: "row",
		paddingVertical: 6,
		alignItems: "flex-start",
	},
	tableRowsRule: {
		borderBottomWidth: 0.5,
		borderBottomColor: LINE,
	},
	descCol: { width: "30%", paddingRight: 6 },
	lineSub: {
		fontFamily: F_SANS,
		fontSize: 7.75,
		fontWeight: 400,
		color: MUTED,
		marginTop: 1,
		lineHeight: 1.28,
	},
	cellRight: { textAlign: "right" as const },
	cellFig: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: BODY,
	},
	cellFigStrong: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 700,
		color: BODY,
	},
	totalsBlock: {
		marginTop: 10,
		alignSelf: "flex-end",
		width: 260,
	},
	totalLine: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 3,
	},
	totalLbl: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: MUTED,
	},
	totalFig: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: BODY,
		textAlign: "right",
	},
	totalGrand: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		marginTop: 6,
		paddingTop: 5,
		borderTopWidth: 0.5,
		borderTopColor: LINE,
	},
	/** Neplátce: no VAT sub-rows — avoid double rule with table bottom */
	totalGrandNoVatIssuer: {
		borderTopWidth: 0,
		paddingTop: 0,
		marginTop: 8,
	},
	totalGrandLbl: {
		fontFamily: F_SANS,
		fontSize: 8.5,
		fontWeight: 700,
		color: BODY,
	},
	totalGrandFig: {
		fontFamily: F_SANS,
		fontSize: 15,
		fontWeight: 700,
		color: BODY,
		lineHeight: 1.05,
	},
	legalMini: {
		fontFamily: F_SANS,
		fontWeight: 400,
		marginTop: 6,
		fontSize: 7.75,
		lineHeight: 1.33,
		color: MUTED,
	},
	asideTitle: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 700,
		color: BODY,
	},
	paymentOuter: {
		width: "100%",
		marginTop: 14,
		paddingTop: 10,
		borderTopWidth: 0.5,
		borderTopColor: LINE,
		flexDirection: "row",
		alignItems: "flex-start",
	},
	/** Fixed column + flex sibling with flexBasis:0 prevents QR/text overlap under Yoga */
	paymentQrCol: {
		width: 104,
		height: 104,
		flexShrink: 0,
		flexGrow: 0,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 12,
	},
	paymentNoteCol: {
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		minWidth: 0,
		maxWidth: "100%",
	},
	paymentNoteColPadQr: {
		paddingLeft: 6,
	},
	paymentHint: {
		fontFamily: F_SANS,
		fontSize: 7.5,
		fontWeight: 400,
		color: MUTED,
		marginTop: 8,
		lineHeight: 1.4,
	},
	paySectionHeading: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 700,
		color: BODY,
		marginBottom: 6,
	},
	payMethodTxt: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 400,
		color: MUTED,
		marginTop: 2,
	},
	qr: { width: 96, height: 96, flexShrink: 0 },
	footerRow: {
		position: "absolute",
		bottom: 28,
		left: 42,
		right: 42,
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "flex-end",
		borderTopWidth: 0,
		borderTopColor: LINE,
		paddingTop: 7,
	},
	footerBrand: {
		fontFamily: F_SANS,
		fontSize: 7,
		color: MUTED,
		textAlign: "right",
	},
	footerBrandStrong: { fontWeight: 700, color: BODY },
	stampSigRow: {
		marginTop: 14,
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
	creditInline: {
		fontFamily: F_SANS,
		fontSize: 8,
		fontWeight: 700,
		color: BODY,
	},
});

function fmtMoneyCz(n: number): string {
	return new Intl.NumberFormat("cs-CZ", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(n);
}

function fmtDateIsoLocal(dateIso: string): string {
	const value = new Date(dateIso);
	if (Number.isNaN(value.getTime())) {
		return dateIso;
	}
	return new Intl.DateTimeFormat("cs-CZ", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(value);
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
	const chunks: string[] = [];
	for (let i = 0; i < clean.length; i += 4) {
		chunks.push(clean.slice(i, i + 4));
	}
	return chunks.join("\u00a0");
}

function paymentMethodLabel(
	method: Invoice["payment"]["method"],
): string {
	switch (method) {
		case "transfer":
			return "Převodem";
		case "cash":
			return "Hotově";
		case "card":
			return "Kartou";
		default: {
			const _never: never = method;
			return _never;
		}
	}
}

function countryHuman(code: string): string {
	return code === "CZ" ? "Česká republika" : code;
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

function invoicePdfMainTitle(inv: Invoice): string {
	switch (inv.meta.docType) {
		case "invoice":
			return `Faktura ${inv.meta.number}`;
		case "credit_note":
			return `Dobropis ${inv.meta.number}`;
		case "proforma":
			return `Proforma faktura ${inv.meta.number}`;
		case "advance":
			return `Zálohová faktura ${inv.meta.number}`;
		default: {
			const _never: never = inv.meta.docType;
			return _never;
		}
	}
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

function PdfKv({
	k,
	v,
	first,
}: Readonly<{
	k: string;
	v: string;
	first?: boolean;
}>) {
	const rs =
		first === true ? [styles.kvRow, styles.kvRowFirst] : styles.kvRow;
	return (
		<View style={rs}>
			<View style={styles.kvKeyCol}>
				<Text style={styles.kvKey}>{k}</Text>
			</View>
			<View style={styles.kvValCol}>
				<Text style={styles.kvVal}>{v}</Text>
			</View>
		</View>
	);
}

function PdfPaymentKv({
	k,
	v,
	first,
}: Readonly<{
	k: string;
	v: string;
	first?: boolean;
}>) {
	const rs =
		first === true ? [styles.kvRow, styles.kvRowFirst] : styles.kvRow;
	return (
		<View style={rs}>
			<View style={styles.paymentKvKeyCol}>
				<Text style={styles.kvKey}>{k}</Text>
			</View>
			<View style={styles.paymentKvValCol}>
				<Text style={styles.kvVal}>{v}</Text>
			</View>
		</View>
	);
}

function PdfInvoiceLineRow({ item }: Readonly<{ item: InvoiceItem }>) {
	const { title, detail } = splitDescription(item.description);
	return (
		<View style={styles.lineRow}>
			<View style={styles.descCol}>
				<Text style={styles.cellFigStrong}>{title}</Text>
				{detail ? <Text style={styles.lineSub}>{detail}</Text> : null}
			</View>
			<Text style={[styles.thQty, styles.cellFig, styles.cellRight]}>{fmtQty(item.quantity)}</Text>
			<Text style={[styles.thUnit, styles.cellFig]}>{item.unit}</Text>
			<Text style={[styles.thUnitPx, styles.cellFig, styles.cellRight]}>{`${fmtMoneyCz(item.unitPriceWithoutVat)}\u00a0Kč`}</Text>
			<Text style={[styles.thVat, styles.cellFig, styles.cellRight]}>{`${String(item.vatRate)}\u00a0%`}</Text>
			<Text style={[styles.thTot, styles.cellFigStrong, styles.cellRight]}>{`${fmtMoneyCz(item.lineTotal)}\u00a0Kč`}</Text>
		</View>
	);
}

export interface InvoicePdfDocumentProps {
	readonly invoice: Invoice;
	readonly assets: InvoicePdfAssets;
}

export function InvoicePdfDocument({
	invoice: inv,
	assets,
}: InvoicePdfDocumentProps) {
	const showStamp = inv.customization?.showStamp === true;
	const showSignature = inv.customization?.showSignature === true;

	const showDuzp =
		inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";

	const showRecapDetail =
		inv.issuer.vatPayer
		&& inv.vat.mode === "regular"
		&& inv.totals.vatBreakdown.length > 0
		&& inv.totals.vatTotal > 0;

	const sortedItems = [...inv.items].sort((a, b) => a.position - b.position);

	const issuerCountry = countryHuman(inv.issuer.address.country);
	const clientCountry = countryHuman(inv.client.address.country);

	const transfer =
		inv.payment.method === "transfer" && inv.payment.bankAccount;
	const hasQr = Boolean(assets.qrDataUrl);
	const showClientIdentifiers =
		Boolean(inv.client.ico)
		|| Boolean(inv.client.dic)
		|| Boolean(inv.client.contactEmail);

	return (
		<Document title={invoicePdfMainTitle(inv)} creator="Invoicey">
			<Page size="A4" style={styles.page}>
				<View style={styles.mainColumn}>
					<View style={styles.upperSheet}>
						<View style={styles.upperTopRow}>
							<View style={styles.upperTopCol}>
								<View style={styles.heroMin}>
									{assets.logo ? (
										<Image style={styles.logoImg} src={assets.logo} />
									) : null}
								</View>
							</View>
							<View style={styles.upperTopCol}>
								<View style={styles.heroMin}>
									<View style={styles.titleColRule} />
									<Text style={styles.invoiceTitle}>
										{invoicePdfMainTitle(inv)}
									</Text>
									<Text style={styles.docKindMicro}>
										{docKindUpper(inv)}
									</Text>
								</View>
							</View>
						</View>

						<View style={styles.partyPairRow}>
							<View style={styles.partyCol}>
								<View style={styles.sectionHairShort} />
								<Text style={styles.sectionCaps}>DODAVATEL</Text>
								<Text style={styles.partyName}>{inv.issuer.name}</Text>
								<Text style={styles.partyAddr}>{inv.issuer.address.street}</Text>
								<Text style={styles.partyAddrTight}>
									{inv.issuer.address.zip}
									{", "}
									{inv.issuer.address.city}
								</Text>
								<Text style={styles.partyAddrTight}>{issuerCountry}</Text>
								<View style={styles.kvBlock}>
									<PdfKv first k="IČO" v={inv.issuer.ico} />
									{inv.issuer.vatPayer && inv.issuer.dic ? (
										<PdfKv k="DIČ" v={inv.issuer.dic} />
									) : null}
									{!inv.issuer.vatPayer ? (
										<PdfKv k="DPH" v="Neplátce" />
									) : null}
									<PdfKv k="Kontaktní email" v={inv.issuer.contactEmail} />
								</View>
								{inv.issuer.registryNote ? (
									<Text style={[styles.partyAddrTight, { marginTop: 6 }]}>
										{inv.issuer.registryNote}
									</Text>
								) : null}
								<View style={styles.kvBlockGap}>
									{transfer ? (
										<PdfKv first k="Bankovní účet" v={transfer.accountNumber} />
									) : null}
									{transfer && inv.payment.variableSymbol ? (
										<PdfKv
											first={false}
											k="Variabilní symbol"
											v={inv.payment.variableSymbol}
										/>
									) : null}
									<PdfKv
										first={
											!transfer
										}
										k="Způsob platby"
										v={paymentMethodLabel(inv.payment.method)}
									/>
								</View>
							</View>

							<View style={styles.partyCol}>
								<View style={styles.sectionHairShort} />
								<Text style={styles.sectionCaps}>ODBĚRATEL</Text>
								<Text style={styles.partyName}>{inv.client.name}</Text>
								<Text style={styles.partyAddr}>{inv.client.address.street}</Text>
								<Text style={styles.partyAddrTight}>
									{inv.client.address.zip}
									{", "}
									{inv.client.address.city}
								</Text>
								<Text style={styles.partyAddrTight}>{clientCountry}</Text>
								{showClientIdentifiers ? (
									<View style={styles.kvBlock}>
										{inv.client.ico ? (
											<PdfKv first k="IČO" v={inv.client.ico} />
										) : null}
										{inv.client.dic ? (
											<PdfKv first={!inv.client.ico} k="DIČ" v={inv.client.dic} />
										) : null}
										{inv.client.contactEmail ? (
											<PdfKv
												first={
													!inv.client.ico && !inv.client.dic
												}
												k="Kontaktní email"
												v={inv.client.contactEmail}
											/>
										) : null}
									</View>
								) : null}
								<View style={styles.kvBlockGap}>
									<PdfKv first k="Datum vystavení" v={fmtDateIsoLocal(inv.meta.issueDate)} />
									<PdfKv k="Datum splatnosti" v={fmtDateIsoLocal(inv.meta.dueDate)} />
									{showDuzp ? (
										<PdfKv
											k="Datum zdan. plnění"
											v={fmtDateIsoLocal(inv.meta.duzp)}
										/>
									) : null}
								</View>
							</View>
						</View>
					</View>

					{inv.meta.docType === "credit_note" && inv.meta.correctedInvoiceNumber ? (
						<Text style={[styles.partyAddr, { marginTop: 8 }]}>
							Opravuje doklad č.:{" "}
							<Text style={styles.creditInline}>
								{inv.meta.correctedInvoiceNumber}
							</Text>
						</Text>
					) : null}

					<View style={styles.tableWrap}>
						<View style={styles.tableHeadRow}>
							<Text style={[styles.th, styles.thDesc]}>POPIS</Text>
							<Text style={[styles.th, styles.thQty]}>MN.</Text>
							<Text style={[styles.th, styles.thUnit]}>{"J."}</Text>
							<Text style={[styles.th, styles.thUnitPx]}>{"CENA ZA MJ"}</Text>
							<Text style={[styles.th, styles.thVat]}>DPH</Text>
							<Text style={[styles.th, styles.thTot]}>{"CELKEM BEZ DPH"}</Text>
						</View>
						<View style={styles.tableRowsRule}>
							{sortedItems.map((it) => (
								<PdfInvoiceLineRow key={it.position} item={it} />
							))}
						</View>
					</View>

					<View style={styles.totalsBlock}>
						{inv.issuer.vatPayer ? (
							<>
								<View style={styles.totalLine}>
									<Text style={styles.totalLbl}>Celkem bez DPH</Text>
									<Text style={styles.totalFig}>
										{`${fmtMoneyCz(inv.totals.subtotal)}\u00a0Kč`}
									</Text>
								</View>
								{showRecapDetail
									? inv.totals.vatBreakdown.map((row) => (
											<PdfVatRow key={`${row.rate}`} row={row} />
										))
									: null}
								{!showRecapDetail ? (
									<View style={styles.totalLine}>
										<Text style={styles.totalLbl}>DPH</Text>
										<Text style={styles.totalFig}>
											{`${fmtMoneyCz(inv.totals.vatTotal)}\u00a0Kč`}
										</Text>
									</View>
								) : null}
							</>
						) : null}

						<View
							style={
								inv.issuer.vatPayer
									? styles.totalGrand
									: [styles.totalGrand, styles.totalGrandNoVatIssuer]
							}
						>
							<Text style={styles.totalGrandLbl}>K úhradě</Text>
							<Text style={styles.totalGrandFig}>
								{`${fmtMoneyCz(inv.totals.total)}\u00a0Kč`}
							</Text>
						</View>
					</View>

					{!inv.issuer.vatPayer ? (
						<Text style={styles.legalMini}>Nejsem plátce DPH.</Text>
					) : null}

					{inv.vat.mode === "reverse_charge" ? (
						<View style={{ marginTop: 6 }}>
							<Text style={styles.asideTitle}>Přenesená daňová povinnost</Text>
							<Text style={[styles.legalMini, { color: MUTED }]}>
								{inv.vat.legalNote
									?? "Daň odvede zákazník dle § 92a zákona č. 235/2004 Sb."}
							</Text>
						</View>
					) : null}

					{inv.vat.mode === "oss" ? (
						<View style={{ marginTop: 6 }}>
							<Text style={styles.asideTitle}>Režim OSS</Text>
							<Text style={[styles.legalMini, { color: MUTED }]}>
								{inv.vat.legalNote
									?? "Zdaněno v režimu jednoho registračního místa OSS (země příjemce)."}
							</Text>
						</View>
					) : null}

					<View style={styles.paymentOuter}>
						{hasQr && assets.qrDataUrl ? (
							<View style={styles.paymentQrCol}>
								<Image style={styles.qr} src={assets.qrDataUrl} />
							</View>
						) : null}
						<View
							style={
								hasQr
									? [styles.paymentNoteCol, styles.paymentNoteColPadQr]
									: styles.paymentNoteCol
							}
						>
							<Text style={styles.paySectionHeading}>PLATEBNÍ ÚDAJE</Text>
							{transfer ? (
								<View style={[styles.kvBlock, styles.paymentDetailKv]}>
									<PdfPaymentKv
										first
										k="Bankovní účet"
										v={transfer.accountNumber}
									/>
									<PdfPaymentKv
										k="IBAN"
										v={formatIbanDisplay(transfer.iban)}
									/>
									{transfer.bic ? (
										<PdfPaymentKv k="SWIFT / BIC" v={transfer.bic} />
									) : null}
									{inv.payment.variableSymbol ? (
										<PdfPaymentKv
											k="Variabilní symbol"
											v={inv.payment.variableSymbol}
										/>
									) : null}
									{inv.payment.constantSymbol ? (
										<PdfPaymentKv
											k="Konstantní symbol"
											v={inv.payment.constantSymbol}
										/>
									) : null}
									{inv.payment.specificSymbol ? (
										<PdfPaymentKv
											k="Specifický symbol"
											v={inv.payment.specificSymbol}
										/>
									) : null}
									<PdfPaymentKv
										k="Způsob platby"
										v={paymentMethodLabel(inv.payment.method)}
									/>
									{hasQr ? (
										<Text style={styles.paymentHint}>
											Úhradu můžete provést naskenováním QR kódu.
										</Text>
									) : null}
								</View>
							) : inv.payment.method === "cash" ? (
								<Text style={styles.payMethodTxt}>Platba v hotovosti</Text>
							) : (
								<Text style={styles.payMethodTxt}>Platba kartou</Text>
							)}
						</View>
					</View>

					{inv.notes ? (
						<View style={{ marginTop: 10 }}>
							<Text style={styles.asideTitle}>Poznámka</Text>
							<Text style={styles.legalMini}>{inv.notes}</Text>
						</View>
					) : null}

					{(showStamp && assets.stamp) || (showSignature && assets.signature) ? (
						<View style={styles.stampSigRow}>
							{showStamp && assets.stamp ? (
								<Image style={styles.stampSig} src={assets.stamp} />
							) : (
								<View />
							)}
							{showSignature && assets.signature ? (
								<View style={styles.stampSigBox}>
									<Image style={styles.stampSig} src={assets.signature} />
								</View>
							) : null}
						</View>
					) : null}
				</View>

				<View fixed style={styles.footerRow} wrap={false}>
					<Text style={styles.footerBrand}>
						Vystaveno přes{" "}
						<Text style={styles.footerBrandStrong}>Invoicey</Text>
					</Text>
				</View>
			</Page>
		</Document>
	);
}

function PdfVatRow({
	row,
}: Readonly<{ row: InvoiceVatBreakdownRowModel }>) {
	return (
		<View style={styles.totalLine}>
			<Text style={styles.totalLbl}>{`DPH ${String(row.rate)}\u00a0%`}</Text>
			<Text style={styles.totalFig}>{`${fmtMoneyCz(row.vat)}\u00a0Kč`}</Text>
		</View>
	);
}
