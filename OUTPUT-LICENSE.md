# Who owns generated code

**You do.** Files that kilngen writes into your output repositories (SDKs, docs sites, CLIs, MCP servers, Terraform providers) are owned by you. kilngen's authors claim no copyright in them, and you may license them however you like, including under proprietary terms.

Some generated files contain small runtime helpers (HTTP retry logic, pagination helpers, SSE parsing and so on) that come from kilngen's templates. Those templates are released under the **MIT No Attribution (MIT-0)** license, so they carry no attribution or notice obligations either:

```
MIT No Attribution

Copyright (c) 2026 George Kal and kilngen contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

Rule for contributors: anything under a `templates/` or `runtime/` directory of a target package ends up in users' output and must be original work under MIT-0. Do not paste third-party code there, even permissively licensed code, because its notice requirements would pass to every user. See [CLEANROOM.md](CLEANROOM.md).
