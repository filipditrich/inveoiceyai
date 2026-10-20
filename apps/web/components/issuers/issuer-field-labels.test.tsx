import { Input } from "@/components/ui/input";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FieldGroup } from "./issuer-form-shared";

// Guards against visible field captions that do not label their controls.
describe("issuer field labels", () => {
  for (const [name, Control] of [
    ["Base UI input", Input],
    ["textarea", "textarea"],
    ["select", "select"],
  ] as const) {
    it(`connects the label to a ${name}`, () => {
      const html = renderToStaticMarkup(
        <FieldGroup label="Company name">
          <Control id="company-name" />
        </FieldGroup>,
      );
      expect(html).toContain('for="company-name"');
      expect(html).toMatch(/<(?:input|textarea|select)[^>]*id="company-name"/);
    });
  }
  it("connects an explicitly grouped ARES input without labeling its wrapper", () => {
    const html = renderToStaticMarkup(
      <FieldGroup label="Company ID" controlId="company-ico">
        <div>
          <Input id="company-ico" />
          <button>Look up</button>
        </div>
      </FieldGroup>,
    );
    expect(html).toContain('for="company-ico"');
    expect(html).toMatch(/<input[^>]*id="company-ico"/);
    expect(html).not.toMatch(/<div[^>]*id="company-ico"/);
  });
});
