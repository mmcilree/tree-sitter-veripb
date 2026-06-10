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

Two approaches are supported: using
[nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) (the most
common path) or the native tree-sitter support built into Neovim 0.9+.

### With nvim-treesitter

#### Step 1 — register the parser

Add this **before** your nvim-treesitter `setup()` call (or inside the `config`
function if you use lazy.nvim):

```lua
local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.veripb = {
  install_info = {
    url = "https://github.com/mcilree/tree-sitter-veripb",
    files = { "src/parser.c" },
    branch = "main",
  },
  filetype = "veripb",
}
```

#### Step 2 — detect `.pbp` files as `veripb`

```lua
vim.filetype.add({ extension = { pbp = "veripb" } })
```

#### Step 3 — install the parser

```
:TSInstall veripb
```

#### Step 4 — enable highlights (if not already on)

Ensure `highlight` is enabled in your nvim-treesitter config:

```lua
require("nvim-treesitter.configs").setup({
  highlight = { enable = true },
  -- ...
})
```

#### lazy.nvim example

```lua
{
  "nvim-treesitter/nvim-treesitter",
  build = ":TSUpdate",
  config = function()
    -- Register the parser before setup
    local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
    parser_config.veripb = {
      install_info = {
        url = "https://github.com/mcilree/tree-sitter-veripb",
        files = { "src/parser.c" },
        branch = "main",
      },
      filetype = "veripb",
    }

    require("nvim-treesitter.configs").setup({
      ensure_installed = { "veripb" },
      highlight = { enable = true },
    })
  end,
},
-- Detect .pbp files (can live anywhere in your config)
{
  "mcilree/tree-sitter-veripb",
  init = function()
    vim.filetype.add({ extension = { pbp = "veripb" } })
  end,
},
```

### Without nvim-treesitter (native Neovim 0.9+)

Neovim 0.9+ has built-in tree-sitter support that doesn't require the
nvim-treesitter plugin. This approach gives you syntax highlighting by placing
the compiled parser and query files in standard locations.

#### Step 1 — compile the parser

```sh
# From the repository root
cc -shared -fPIC -o veripb.so src/parser.c
# On macOS, use:
# cc -shared -fPIC -undefined dynamic_lookup -o veripb.so src/parser.c
```

#### Step 2 — install the compiled parser

```sh
# Create the parser directory if it doesn't exist
mkdir -p ~/.local/share/nvim/site/parser
cp veripb.so ~/.local/share/nvim/site/parser/veripb.so
```

Or from Lua (e.g. in a setup script):

```lua
local dest = vim.fn.stdpath("data") .. "/site/parser/veripb.so"
```

#### Step 3 — install the query files

```sh
mkdir -p ~/.config/nvim/queries/veripb
cp queries/highlights.scm ~/.config/nvim/queries/veripb/highlights.scm
```

#### Step 4 — register the filetype and parser

Add to your `init.lua`:

```lua
-- Detect .pbp files
vim.filetype.add({ extension = { pbp = "veripb" } })

-- Register the language with Neovim's tree-sitter integration
vim.treesitter.language.register("veripb", "veripb")
```

#### Step 5 — enable highlighting in your ftplugin

Create `~/.config/nvim/ftplugin/veripb.lua`:

```lua
vim.treesitter.start()
```

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

To test against the VeriPB proof corpus:

```sh
# All files should parse with zero ERROR nodes
for f in tests/instances/**/*.pbp; do
  tree-sitter parse --quiet "$f" || echo "FAIL: $f"
done
```

## Grammar reference

The VeriPB 3.0 grammar specification is in [`docs/grammar.tex`](docs/grammar.tex).
