# tree-sitter-veripb

> **AI assistance disclosure:** This grammar was developed with substantial
> assistance from [Claude Code](https://claude.ai/claude-code) (Anthropic,
> claude-sonnet-4-6). The grammar design, implementation, and documentation
> were produced collaboratively. The author reviewed and directed the work
> throughout; all commits are attributed accordingly.

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the
[VeriPB](veripb.org) pseudo-Boolean proof format.

Supports **VeriPB 3.0**:
- `.pbp` proof files (root grammar). Legacy **VeriPB 2.0** `.pbp` proofs are also
  parsed: the grammar dispatches on the header line (`version 2.0` vs `version 3.0`).
- `.opb` input formula files in VeriPB's XPB (extended pseudo-Boolean) dialect
  (`opb/` subgrammar)

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
| Reverse Unit Propagation | `rup` |
| Strengthening/Proof by Contradiction| `red`, `dom`, `pbc` |
| Deletion | `del`, `delc`, `deld` |
| Objective | `obju`, `obji`, `eobj` |
| Solutions | `sol`, `soli`, `solx` |
| Orders | `def_order`, `load_order`, `eord_def`, `eord_loaded` |
| Levels | `setlvl`, `wiplvl` |
| Convenience Checks | `e`, `i`, `ia`, `f`, `a`, `is_deleted`, `fail` |
| Timing | `start_time`, `end_time` |
| Misc | `core`, `strengthening_to_core` |

## Neovim setup

Two approaches are supported: using
[nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) (the most
common path) or the native tree-sitter support built into Neovim 0.9+.

### With nvim-treesitter

1. Add the following snippet in a `User TSUpdate` autocommand:
```lua
-- Register as a parser available for download
vim.api.nvim_create_autocmd("User", {
	pattern = "TSUpdate",
	callback = function()
		require("nvim-treesitter.parsers").veripb = {
			install_info = {
				url = "https://github.com/mmcilree/tree-sitter-veripb",
				queries = "queries",
			},
		}
	end,
})
```

2. Start `nvim` and `:TSInstall veripb`

3. Modify your config to use `veripb` filetype e.g.

```lua
vim.filetype.add({ extension = { pbp = "veripb" } })
vim.api.nvim_create_autocmd("FileType", {
	pattern = { "veripb" },
	callback = function()
		vim.treesitter.start()
		vim.opt.commentstring = "% %s"
	end,
})
```

### Without nvim-treesitter (native Neovim 0.9+)

Neovim 0.9+ has built-in tree-sitter support that doesn't require the
nvim-treesitter plugin. This approach gives you syntax highlighting by placing
the compiled parser and query files in standard locations.

1. Compile the parser

```sh
# From the repository root
cc -shared -fPIC -o veripb.so src/parser.c
# On macOS, use:
# cc -shared -fPIC -undefined dynamic_lookup -o veripb.so src/parser.c
```

2. Install the compiled parser

```sh
# Create the parser directory if it doesn't exist
mkdir -p ~/.local/share/nvim/site/parser
cp veripb.so ~/.local/share/nvim/site/parser/veripb.so
```

Or from Lua (e.g. in a setup script):

```lua
local dest = vim.fn.stdpath("data") .. "/site/parser/veripb.so"
```

3. Install the query files

```sh
mkdir -p ~/.config/nvim/queries/veripb
cp queries/highlights.scm ~/.config/nvim/queries/veripb/highlights.scm
```
4. `veripb` filetype can then be enabled by modifying config as desired (see step 3. above).

### Highlight groups

The grammar maps to standard tree-sitter capture names, which all major
colorschemes (tokyonight, catppuccin, gruvbox, etc.) support:

| Capture | Examples |
|---|---|
| `@keyword.function` | `pol`, `rup`, `red`, `dom`, `def_order`, `preserved_add`, … |
| `@keyword` | `subproof`, `qed`, `proofgoal`, `output`, `conclusion`, `end`, … |
| `@keyword.modifier` | `vars`, `left`, `right`, `spec`, `def`, `transitivity`, `new`, … |
| `@keyword.directive` | The header line (`pseudo-Boolean proof version 3.0`) |
| `@constant.builtin` | `NONE`, `SAT`, `UNSAT`, `BOUNDS`, `INF`, `ENUMERATION_COMPLETE`, … |
| `@constant` | `DERIVABLE`, `EQUISATISFIABLE`, `EQUIOPTIMAL`, `FILE`, `IMPLICIT`, … |
| `@operator` | `>=`, `<=`, `==>`, `<==`, `+`, `-`, `*`, `c`, `d`, `s`, `w`, … |
| `@number` | Coefficients, constraint IDs, RHS values |
| `@variable` | Variable names in constraints, substitutions, and order definitions |
| `@variable.builtin` | Auxiliary variables (`$aux_var`) |
| `@label` | Constraint labels (`@my_label`) |
| `@namespace` | Order and timer names in `def_order`, `start_time`, … |
| `@comment` | `% …` |
| `@punctuation.delimiter` | `;`, `->` |

## Development

Requirements: Node.js ≥ 18, a C compiler.

```sh
npm install
tree-sitter generate
tree-sitter test
```

To test against the VeriPB proof corpus, clone the
[VeriPB repository](https://gitlab.com/MIAOresearch/software/VeriPB) and point
the parser at its correct instances:

```sh
git clone https://gitlab.com/MIAOresearch/software/VeriPB
# All correct instances should parse with zero ERROR nodes
for f in VeriPB/tests/instances/correct/**/*.pbp; do
  tree-sitter parse --quiet "$f" || echo "FAIL: $f"
done
```

## Grammar reference

The VeriPB 3.0 grammar specification is maintained in the VeriPB repository:

- **EBNF grammar:** [`docs/grammar.tex`](https://gitlab.com/MIAOresearch/software/VeriPB/-/blob/main/docs/grammar.tex) (and rendered [PDF](https://gitlab.com/api/v4/projects/70013030/jobs/artifacts/main/raw/docs/grammar.pdf?job=build-grammar-doc&search_recent_successful_pipelines=true))
- **Test corpus:** [`tests/instances/correct/`](https://gitlab.com/MIAOresearch/software/VeriPB/-/tree/main/tests/instances/correct/version3)
