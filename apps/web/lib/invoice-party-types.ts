import type {
	ClientSnapshot,
	IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

export type IssuerOption = {
	id: string;
	snapshot: IssuerSnapshot;
	schemes: Array<{
		docType: string;
		template: string;
		counter: number;
		counterYear: number | null;
		resetPeriod: string;
		padding: number;
	}>;
};

export type ClientOption = {
	id: string;
	snapshot: ClientSnapshot;
};
