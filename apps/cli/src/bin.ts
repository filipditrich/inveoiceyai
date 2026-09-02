#!/usr/bin/env bun

import { run } from "./main";

const code = await run(process.argv.slice(2));
process.exit(code);
