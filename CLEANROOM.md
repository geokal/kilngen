# Clean-room policy

kilngen offers features similar to Stainless, a proprietary product. To keep kilngen free of anyone else's intellectual property, every contributor follows these rules.

## Allowed sources

- Stainless's **public documentation**, to understand _what_ features exist (feature names, user-visible behavior, config concepts). Describe the behavior in your own words in an issue or design doc before implementing it.
- The **Apache-2.0** repository `stainless-api/stainless-api-cli`, as a behavioral reference for CLI UX (commands, flags, output formats, workspace discovery).
- Public standards and their docs: OpenAPI, JSON Schema, MCP, Terraform plugin framework, language style guides.
- Open-source SDK generators and SDKs under licenses compatible with MIT, with attribution where their license requires it.

## Not allowed

- Copying text, code, examples, templates, CSS, images, logos or other assets from Stainless's website, docs, dashboard or any Stainless-generated SDK into this repository.
- Reverse engineering Stainless binaries, hosted APIs or minified dashboard code.
- Using any non-public Stainless material, including anything learned under an NDA or employment. If you have worked at Stainless, tell the maintainers before contributing to the generator.
- Copying code from `stainless-api-cli` (or any other third-party source) into **templates or runtime code that ship in generated output**. See [OUTPUT-LICENSE.md](OUTPUT-LICENSE.md).
- Using "Stainless", or a confusingly similar name or logo, in package names, file names, config keys, commands or marketing. Config is `kilngen.yml`, not `stainless.yml`; extensions are `x-kilngen-*`, not `x-stainless-*`.

## Compatibility

Reading a user's existing Stainless config to help them migrate is a desirable feature. It lives in a separate, clearly named importer (`kilngen import stainless`, planned), works from the publicly documented config format only, and never ships Stainless assets.

## Process

1. Write the behavior down in an issue or ADR (in your own words, citing which public page you read).
2. Implement from that description.
3. In the PR, tick the clean-room checkbox in the template.

This policy is engineering guidance, not legal advice. Have a lawyer review it before a 1.0 release.
