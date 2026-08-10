import { z } from "zod";

export const IcoSchema = z
	.string()
	.regex(/^\d{8}$/, "IČO must be exactly 8 digits");

/** Issuer DIČ — Czech format only. */
export const DicSchema = z
	.string()
	.regex(/^CZ\d{8,10}$/, "DIČ must be CZ followed by 8–10 digits");

/**
 * Client VAT ID — Czech DIČ or EU-style VAT number (e.g. DE...).
 */
export const ClientVatIdSchema = z
	.string()
	.regex(
		/^(CZ\d{8,10}|[A-Z]{2}[A-Za-z0-9]{2,14})$/,
		"Invalid client DIČ / VAT ID",
	);

export const AddressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	zip: z.string().regex(/^\d{3} ?\d{2}$/, "PSČ must be 5 digits"),
	country: z.literal("CZ"),
});

export const ClientAddressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	zip: z.string().regex(/^\d{3} ?\d{2}|[A-Z0-9 \-]{3,10}$/),
	country: z.string().regex(/^[A-Z]{2}$/),
});

export const BankAccountSchema = z.object({
	accountNumber: z.string().regex(/^(?:\d{1,6}-)?\d{1,10}\/\d{4}$/),
	iban: z.string().regex(/^CZ\d{22}$/),
	bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),
});

export const VatRateSchema = z.union([
	z.literal(0),
	z.literal(12),
	z.literal(21),
	z.number().min(0).max(100).int(),
]);

export const InvoiceVatSchema = z.object({
	mode: z.enum(["regular", "reverse_charge", "oss"]),
	suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
	legalNote: z.string().max(500).optional(),
	localReverseChargeCode: z.string().min(1).max(10).optional(),
});

export const InvoiceMetaSchema = z
	.object({
		docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
		number: z.string().min(1).max(64),
		issueDate: z.string().date(),
		dueDate: z.string().date(),
		duzp: z.string().date(),
		language: z.literal("cs"),
		currency: z.literal("CZK"),
		correctedInvoiceNumber: z.string().min(1).max(64).optional(),
	})
	.superRefine((meta, ctx) => {
		if (meta.docType === "credit_note" && !meta.correctedInvoiceNumber) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "credit_note requires correctedInvoiceNumber",
				path: ["correctedInvoiceNumber"],
			});
		}
		const issue = Date.parse(`${meta.issueDate}T00:00:00.000Z`);
		const due = Date.parse(`${meta.dueDate}T00:00:00.000Z`);
		if (!Number.isNaN(issue) && !Number.isNaN(due) && due < issue) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "dueDate must be on or after issueDate",
				path: ["dueDate"],
			});
		}
	});

export const IssuerSnapshotSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(200),
	ico: IcoSchema,
	dic: DicSchema.optional(),
	address: AddressSchema,
	bank: BankAccountSchema,
	vatPayer: z.boolean(),
	logoUrl: z.string().url().optional(),
	stampUrl: z.string().url().optional(),
	signatureUrl: z.string().url().optional(),
	registryNote: z.string().max(500).optional(),
	contactEmail: z.string().trim().email(),
});

export type IssuerSnapshot = z.infer<typeof IssuerSnapshotSchema>;

export const ClientSnapshotSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(200),
	ico: IcoSchema.optional(),
	dic: ClientVatIdSchema.optional(),
	address: ClientAddressSchema,
	contactEmail: z.string().email().optional(),
});

export type ClientSnapshot = z.infer<typeof ClientSnapshotSchema>;

export const PaymentSchema = z
	.object({
		method: z.enum(["transfer", "cash", "card"]),
		bankAccount: BankAccountSchema.optional(),
		variableSymbol: z.string().regex(/^\d{1,10}$/).optional(),
		constantSymbol: z.string().regex(/^\d{1,4}$/).optional(),
		specificSymbol: z.string().regex(/^\d{1,10}$/).optional(),
		instructionsBefore: z.string().max(2000).optional(),
		instructionsAfter: z.string().max(2000).optional(),
	})
	.superRefine((pay, ctx) => {
		if (pay.method === "transfer" && !pay.bankAccount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "transfer requires bankAccount",
				path: ["bankAccount"],
			});
		}
	});

export const InvoiceItemSchema = z.object({
	position: z.number().int().min(1),
	description: z.string().min(1).max(500),
	quantity: z
		.number()
		.refine((q) => q !== 0, "quantity must be non-zero"),
	unit: z.string().min(1).max(20),
	unitPriceWithoutVat: z.number().nonnegative(),
	vatRate: VatRateSchema,
	lineSubtotal: z.number(),
	lineVat: z.number(),
	lineTotal: z.number(),
});

export const VatBreakdownEntrySchema = z.object({
	rate: z.number().min(0).max(100),
	base: z.number(),
	vat: z.number(),
});

export const TotalsSchema = z.object({
	subtotal: z.number(),
	vatBreakdown: z.array(VatBreakdownEntrySchema),
	vatTotal: z.number(),
	total: z.number(),
});

export const InvoiceCustomizationSchema = z.object({
	accentColor: z
		.enum(["neutral", "blue", "green", "amber", "rose", "violet"])
		.default("neutral"),
	showStamp: z.boolean().default(false),
	showSignature: z.boolean().default(false),
});

export const InvoiceSchema = z
	.object({
		meta: InvoiceMetaSchema,
		issuer: IssuerSnapshotSchema,
		client: ClientSnapshotSchema,
		vat: InvoiceVatSchema,
		payment: PaymentSchema,
		items: z.array(InvoiceItemSchema).min(1),
		totals: TotalsSchema,
		notes: z.string().max(2000).optional(),
		customization: InvoiceCustomizationSchema.optional(),
	})
	.superRefine((inv, ctx) => {
		const docType = inv.meta.docType;
		const isCredit = docType === "credit_note";

		if (inv.vat.mode === "oss" && inv.vat.suppliesAbroad === "none") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "oss requires supplies Abroad other than none",
				path: ["vat", "suppliesAbroad"],
			});
		}

		if (!inv.issuer.vatPayer) {
			if (inv.vat.mode !== "regular") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "non–VAT-payer issuer requires vat.mode regular",
					path: ["vat", "mode"],
				});
			}
			for (const item of inv.items) {
				if (item.vatRate !== 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "non–VAT-payer requires vatRate 0 on every line",
						path: ["items", inv.items.indexOf(item), "vatRate"],
					});
				}
			}
		}

		if (inv.vat.mode === "reverse_charge") {
			if (!inv.issuer.vatPayer) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "reverse_charge requires VAT-payer issuer",
					path: ["vat", "mode"],
				});
			}
			if (!inv.client.dic) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "reverse_charge requires client DIČ / VAT ID",
					path: ["client", "dic"],
				});
			}
			if (!inv.vat.localReverseChargeCode?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "reverse_charge requires localReverseChargeCode",
					path: ["vat", "localReverseChargeCode"],
				});
			}
			for (const item of inv.items) {
				if (item.vatRate !== 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "reverse_charge requires vatRate 0 on every line",
						path: ["items", inv.items.indexOf(item), "vatRate"],
					});
				}
			}
		}

		for (let i = 0; i < inv.items.length; i++) {
			const item = inv.items[i]!;
			if (isCredit) {
				if (item.quantity >= 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "credit_note lines require negative quantity",
						path: ["items", i, "quantity"],
					});
				}
				if (
					item.lineSubtotal > 0 ||
					item.lineVat > 0 ||
					item.lineTotal > 0
				) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "credit_note line amounts must be zero or negative",
						path: ["items", i, "lineSubtotal"],
					});
				}
			} else {
				if (item.quantity <= 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "non–credit_note lines require positive quantity",
						path: ["items", i, "quantity"],
					});
				}
				if (
					item.lineSubtotal < 0 ||
					item.lineVat < 0 ||
					item.lineTotal < 0
				) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "non–credit_note lines require nonnegative line amounts",
						path: ["items", i, "lineSubtotal"],
					});
				}
			}
		}

		if (isCredit) {
			if (inv.totals.subtotal > 0 || inv.totals.vatTotal > 0 || inv.totals.total > 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "credit_note totals must be zero or negative",
					path: ["totals", "total"],
				});
			}
			for (let i = 0; i < inv.totals.vatBreakdown.length; i++) {
				const row = inv.totals.vatBreakdown[i]!;
				if (row.base > 0 || row.vat > 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "credit_note VAT breakdown must be zero or negative",
						path: ["totals", "vatBreakdown", i],
					});
				}
			}
		} else {
			if (
				inv.totals.subtotal < 0 ||
				inv.totals.vatTotal < 0 ||
				inv.totals.total < 0
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "totals must be nonnegative for this doc type",
					path: ["totals", "total"],
				});
			}
			for (let i = 0; i < inv.totals.vatBreakdown.length; i++) {
				const row = inv.totals.vatBreakdown[i]!;
				if (row.base < 0 || row.vat < 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "VAT breakdown entries must be nonnegative",
						path: ["totals", "vatBreakdown", i],
					});
				}
			}
		}
	});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type Totals = z.infer<typeof TotalsSchema>;
