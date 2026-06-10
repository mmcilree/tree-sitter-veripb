# tree-sitter-veripb

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the
[VeriPB](https://gitlab.com/MIAOresearch/software/VeriPB) pseudo-Boolean proof format.

Supports **VeriPB 3.0** (`.pbp` files).

## Features

- Full coverage of the VeriPB 3.0 grammar: all proof rules, subproofs, proof goals,
  order definitions, scopes, and the footer section
- Syntax highlighting for Neovim (and any editor with tree-sitter support)
- Incremental parsing — handles the very large proof files (multi-GB) that VeriPB
  routinely produces, since editors only parse the visible viewport

## Grammar overview

A VeriPB 3.0 proof file has the structure:

```
pseudo-Boolean proof version 3.0
<proof rules...>
output NONE;
conclusion NONE;
end pseudo-Boolean proof;
```

Rule categories supported:

| Category | Rules |
|---|---|
| Cutting planes | `pol` |
| Propagation | `rup` |
| Strengthening | `red`, `dom`, `pbc` |
| Deletion | `del`, `delc`, `deld` |
| Objective | `obju`, `obji`, `eobj` |
| Solutions | `sol`, `soli`, `solx` |
| Orders | `def_order`, `load_order`, `eord_def`, `eord_loaded` |
| Levels | `setlvl`, `wiplvl` |
| Checks | `e`, `i`, `ia`, `f`, `a`, `is_deleted`, `fail` |
| Timing | `start_time`, `end_time` |
| Misc | `core`, `strengthening_to_core` |

## Neovim setup

### With [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)

Add this to your Neovim config:

```lua
local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.veripb = {
  install_info = {
    url = "https://github.com/your-org/tree-sitter-veripb",
    files = { "src/parser.c" },
    branch = "main",
  },
  filetype = "pbp",
}
```

Then set the filetype for `.pbp` files:

```lua
vim.filetype.add({ extension = { pbp = "veripb" } })
```

Run `:TSInstall veripb` to install.

### Manual (without nvim-treesitter)

Copy the `queries/` directory into your Neovim runtime path under
`queries/veripb/`, and compile `src/parser.c` as a shared library.

## Development

Requirements: Node.js ≥ 18, a C compiler.

```sh
npm install
tree-sitter generate
tree-sitter test
```

To test against the VeriPB proof corpus:

```sh
# All files should parse with zero ERROR nodes
for f in tests/instances/**/*.pbp; do
  tree-sitter parse --quiet "$f" || echo "FAIL: $f"
done
```

## Grammar reference

The VeriPB 3.0 grammar specification is in [`docs/grammar.tex`](docs/grammar.tex).
