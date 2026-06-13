; =========================================================================
; VeriPB 3.0 syntax highlights
; =========================================================================

; -------------------------------------------------------------------------
; Comments
; -------------------------------------------------------------------------

(comment) @comment
(comment_v2) @comment

; -------------------------------------------------------------------------
; Header
; -------------------------------------------------------------------------

(header) @keyword.directive
(header_v2) @keyword.directive

; -------------------------------------------------------------------------
; v2 rule short forms (legacy)
; -------------------------------------------------------------------------

[
  "p"
  "u"
  "o"
  "d"
  "pre_order"
  "begin"
  "find"
  "#"
  "w"
] @keyword.function

; -------------------------------------------------------------------------
; Rule keywords
; -------------------------------------------------------------------------

[
  "pol"
  "rup"
  "red"
  "dom"
  "pbc"
  "del"
  "delc"
  "deld"
  "obju"
  "obji"
  "soli"
  "solx"
  "sol"
  "f"
  "e"
  "i"
  "ia"
  "a"
  "eobj"
  "def_order"
  "load_order"
  "eord_def"
  "eord_loaded"
  "core"
  "setlvl"
  "wiplvl"
  "strengthening_to_core"
  "start_time"
  "end_time"
  "is_deleted"
  "preserved_add"
  "preserved_rm"
  "epreserved"
] @keyword.function

; fail_rule is a terminal token (not a container), so it needs its own capture
(fail_rule) @keyword.function

; -------------------------------------------------------------------------
; Structural keywords (proof scaffolding)
; -------------------------------------------------------------------------

[
  "pseudo-Boolean"
  "proof"
  "subproof"
  "qed"
  "proofgoal"
  "scope"
  "output"
  "conclusion"
  "end"
] @keyword

[
  "vars"
  "left"
  "right"
  "aux"
  "spec"
  "def"
  "transitivity"
  "reflexivity"
  "fresh_right"
  "fresh_aux_1"
  "fresh_aux_2"
  "new"
  "diff"
  "id"
  "range"
  "geq"
  "leq"
  "on"
  "off"
] @keyword.modifier

; -------------------------------------------------------------------------
; Footer constants
; -------------------------------------------------------------------------

[
  "NONE"
  "SAT"
  "UNSAT"
  "BOUNDS"
  "INF"
  "ENUMERATION_COMPLETE"
  "ENUMERATION_PARTIAL"
] @constant.builtin

[
  "DERIVABLE"
  "EQUISATISFIABLE"
  "EQUIOPTIMAL"
  "EQUIENUMERABLE"
  "FILE"
  "IMPLICIT"
  "PERMUTATION"
] @constant

; -------------------------------------------------------------------------
; Operators
; -------------------------------------------------------------------------

[
  (relational_operator)
  "==>"
  "<=="
] @operator

; pol body operators
[
  "+"
  "-"
  "c"
  "d"
  "m"
  "n"
  "s"
  "w"
] @operator

; pol multiplication operator (external token, not a bare "*")
(pol_star_op) @operator

; Substitution arrow (v3 uses `->`, v2 also accepts Unicode `→`)
[
  "->"
  "→"
] @punctuation.delimiter

; -------------------------------------------------------------------------
; Labels  (@name)
; -------------------------------------------------------------------------

(label) @label

; -------------------------------------------------------------------------
; Variables
; -------------------------------------------------------------------------

; Negation prefix on a literal
(literal "~" @operator)

; Regular variable names (identifiers used as variables in constraints/witnesses)
(literal (identifier) @variable)
(literal (aux_variable) @variable.builtin)

; Identifiers used as names (order names, timer names, etc.) keep the
; default @variable capture but within their specific field contexts.
(def_order_rule name: (identifier) @namespace)
(eord_def_rule  name: (identifier) @namespace)
(load_order_rule name: (identifier) @namespace)
(eord_loaded_rule name: (identifier) @namespace)
(start_time_rule name: (identifier) @string.special)
(end_time_rule   name: (identifier) @string.special)
(preserved_add_rule variable: (identifier) @variable)
(preserved_rm_rule  variable: (identifier) @variable)

; Variable lists in order definitions
(variables (identifier) @variable)
(aux_variables (aux_variable) @variable.builtin)
(epreserved_rule (identifier) @variable)

; -------------------------------------------------------------------------
; Numbers
; -------------------------------------------------------------------------

(signed_integer) @number
(unsigned_integer) @number
(positive_integer) @number

; -------------------------------------------------------------------------
; Constraint IDs
; -------------------------------------------------------------------------

; All constraint IDs default to @number (catches negative integers, which
; have no named child node); child label/positive_integer captures below
; override for their respective cases.
(constraint_id) @number

; -------------------------------------------------------------------------
; Proof goal IDs
; -------------------------------------------------------------------------

(proofgoal_id "#" @punctuation.special)

; -------------------------------------------------------------------------
; Punctuation
; -------------------------------------------------------------------------

";" @punctuation.delimiter
"#" @punctuation.special
