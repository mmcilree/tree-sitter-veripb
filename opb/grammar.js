/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * Tree-sitter grammar for VeriPB's XPB (Extended Pseudo-Boolean) input format,
 * the .opb files consumed by VeriPB 3.0.
 *
 * Grammar reference: docs/grammar.tex section "XPB Grammar" (sec:grammar-opb).
 *
 * Design decisions:
 *
 * 1. COMMENTS USE '*' (not '%'): XPB comments start with '*' and run to end of line.
 *    This is the inverse of .pbp where comments start with '%' and '*' is the
 *    multiplication operator inside pol bodies. Handled via `extras`.
 *
 * 2. UNLABELLED vs LABELLED RELATIONAL OPERATOR: grammar.tex distinguishes:
 *      xpb_relational_operator   = "=" | ">=" | "<="   (unlabelled only)
 *      relational_operator       = ">=" | "<="         (labelled, shared with .pbp)
 *    i.e. equality is only allowed on unlabelled constraints. We model this by
 *    using distinct rule names so the syntax tree records the distinction.
 *
 * 3. REIFICATION: proof_format_overview.md documents ==> / <== as an OPB extension
 *    (`literals ==> constraint` or `literal <== constraint`). grammar.tex's
 *    xpb_constraint_* rules omit it, but we follow the overview here since the user
 *    confirmed it should be supported. Mirrors the .pbp `reification` rule.
 *
 * 4. PRESERVED DIRECTIVE: `preserved: <variable>... ;` appears in 17 corpus files
 *    and is documented in proof_format_overview.md but absent from grammar.tex.
 *    We extend past grammar.tex to accept it (otherwise the corpus does not parse).
 *    Empirically it always precedes the objective and constraints, so we model it
 *    as a single optional leading directive. The colon is made optional because
 *    two corpus files in incorrect/ omit it (presumed typos but still must parse).
 *
 * 5. OBJECTIVE AS BARE CONSTANT: grammar.tex allows `min: 0 ;` (just a coefficient)
 *    as the empty objective. Sum vs bare-coefficient share the leading signed-integer
 *    so we declare a conflict and let GLR decide based on whether an identifier follows.
 *
 * 6. EMPTY SUM IN CONSTRAINT: xpb_constraint_unlabelled allows `[xpb_sum]` (sum is
 *    optional), so `>= 1 ;` is a syntactically valid constraint and appears in the
 *    corpus (add_preserved_var_trivial.opb). The labelled form likewise allows it.
 *
 * 7. IDENTIFIER / LITERAL: shared definition with .pbp. Variable names must start
 *    with a letter or underscore and may contain `^[]{}-` etc. We use a single
 *    `identifier` regex; the 2-char-minimum from the spec is not enforced
 *    syntactically (tree-sitter convention).
 */

module.exports = grammar({
  name: 'opb',

  extras: $ => [
    $.comment,
    /[ \t\n\r]+/,
  ],

  word: $ => $.identifier,

  conflicts: $ => [
    // In a sum followed by a trailing constant, a signed integer could either be
    // the start of a new weighted_term or the trailing standalone coefficient.
    // Tree-sitter's GLR resolves once it sees whether a literal follows.
    [$.sum, $.sum],
  ],

  rules: {

    // =========================================================================
    // Top level
    // =========================================================================

    // xpb ::= {skip}, [xpb_objective], {skip | xpb_constraint}
    // Extended with the optional preserved directive (see decision 4).
    source_file: $ => seq(
      optional($.preserved_directive),
      optional($.objective),
      repeat($._constraint),
    ),

    // =========================================================================
    // Preserved directive (extension; see design decision 4)
    // =========================================================================

    preserved_directive: $ => seq(
      'preserved',
      optional(':'),
      repeat1($.variable),
      ';',
    ),

    // =========================================================================
    // Objective
    // =========================================================================

    objective: $ => seq(
      $.objective_type,
      choice(
        seq($.sum, optional($.coefficient)),
        $.coefficient,
      ),
      ';',
    ),

    objective_type: $ => seq(
      choice('min', 'max'),
      ':',
    ),

    // =========================================================================
    // Constraints
    // =========================================================================

    _constraint: $ => choice(
      $.constraint_labelled,
      $.constraint_unlabelled,
    ),

    // Labelled constraints cannot use '=' (only '>=' and '<=').
    constraint_labelled: $ => seq(
      $.label,
      optional($.reification),
      optional($.sum),
      $.relational_operator,
      $.coefficient,
      ';',
    ),

    // Unlabelled constraints can additionally use '='.
    constraint_unlabelled: $ => seq(
      optional($.reification),
      optional($.sum),
      $.xpb_relational_operator,
      $.coefficient,
      ';',
    ),

    relational_operator: _ => choice('>=', '<='),

    xpb_relational_operator: _ => choice('=', '>=', '<='),

    // ==> takes one or more literals on the left; <== takes exactly one.
    reification: $ => choice(
      seq(repeat1($.literal), '==>'),
      seq($.literal, '<=='),
    ),

    // =========================================================================
    // Sums, weighted terms
    // =========================================================================

    sum: $ => repeat1($.weighted_term),

    weighted_term: $ => seq($.coefficient, $.literal),

    coefficient: $ => $.signed_integer,

    // =========================================================================
    // Literals, variables, identifiers
    // =========================================================================

    literal: $ => seq(optional('~'), $.variable),

    variable: $ => $.identifier,

    // letter/underscore start, then any of letter, digit, underscore, ^[]{}-
    // Two-char minimum from the spec is not enforced (tree-sitter convention).
    identifier: _ => /[A-Za-z_][A-Za-z0-9_\^\[\]\{\}\-]*/,

    // =========================================================================
    // Labels and integers
    // =========================================================================

    label: _ => /@[A-Za-z0-9_\^\[\]\{\}\-]+/,

    signed_integer: _ => /[+\-]?(0|[1-9][0-9]*)/,

    // =========================================================================
    // Comments
    // =========================================================================

    // XPB comments: '*' to end-of-line.
    comment: _ => /\*[^\r\n]*/,
  },
});
