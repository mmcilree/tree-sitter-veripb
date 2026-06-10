/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * Tree-sitter grammar for VeriPB 3.0 pseudo-Boolean proof format.
 *
 * Grammar reference: docs/grammar.tex (plus extensions in proof_format_overview.md)
 *
 * Design decisions:
 *
 * 1. HEADER AS TIGHT TOKEN: The spec requires the header line to use only spaces/tabs
 *    (no comments, no newlines) before its mandatory newline. We model this with a
 *    single regex token so extras (whitespace/comment) cannot intrude.
 *
 * 2. FLAT pol BODY: pol uses RPN which is inherently non-LL(1). Rather than encoding
 *    the recursive stack-based structure we flatten the body to repeat1(_pol_token).
 *    This avoids O(n²) GLR ambiguity on long pol chains (common in large proofs) while
 *    still giving every token the correct node type for highlighting.
 *
 * 3. SINGLE-CHAR pol OPERATORS (c, d, m, n, s, w): These are keywords only in the pol
 *    body. Via tree-sitter's word/keyword-extraction they are recognised as keywords
 *    when the parse state expects them, and as plain identifiers (variable names etc.)
 *    everywhere else. The practical restriction is that a 1-char name exactly matching
 *    one of these cannot be used as an order/timer name — acceptable given naming
 *    conventions in practice.
 *
 * 4. IDENTIFIER AS WORD TERMINAL: The spec distinguishes variable (≥2 chars) from
 *    name (≥1 char), but both share the same character set. We use a single `identifier`
 *    public terminal for both. The semantic 2-char minimum for variables is not enforced
 *    at the syntactic level (as is normal for tree-sitter). `identifier` must be a public
 *    (non-`_`) rule because tree-sitter's `word` property requires a named terminal.
 *
 * 5. CONSTRAINT PARSING: constraint = [reification] [sum] relop coefficient. Because
 *    sum and reification are both optional and share literal tokens, we declare them as
 *    conflicts. Tree-sitter's GLR engine resolves these once it sees `==>`, `<==`,
 *    `>=`, or `<=`.
 *
 * 6. PRESERVED_ADD / PRESERVED_RM / EPRESERVED: Not in grammar.tex but present in the
 *    test corpus and documented in proof_format_overview.md. Included here.
 *
 * 7. ENUMERATION_COMPLETE / ENUMERATION_PARTIAL: New conclusion types from the overview,
 *    confirmed in test corpus.
 */

module.exports = grammar({
  name: 'veripb',

  extras: $ => [
    $.comment,
    /[ \t\n\r]+/,
  ],

  // Enables keyword extraction: any string literal that matches this pattern is
  // treated as a keyword rather than an identifier in states where both are valid.
  // Must be a *named* (non-private) terminal — private `_` rules do not work here.
  word: $ => $.identifier,

  conflicts: $ => [
    // In a constraint, optional reification and optional sum both start with literals,
    // so the parser cannot distinguish them until it sees ==> / <== / >= / <=.
    [$.reification, $.sum],
    [$.reification, $.weighted_term],
    // objective vs constraint share the same prefix (sum of weighted terms)
    [$.objective, $.constraint],
    [$.objective, $.sum],
    // Within sum/objective: a bare coefficient could extend the sum (as start of a new
    // weighted_term) or be the trailing constant; GLR resolves on the next token.
    [$.sum, $.sum],
    // pol token: a positive integer could be a constraint_id push or the
    // first operand of a binary int operation (e.g. `3 *`)
    [$.constraint_id, $._pol_int_op],
    // assignment RHS "0"/"1" vs literal starting with a variable
    [$.assignment, $.literal],
    // substitution (list of assignments) vs solution (list of literals) — resolved by context
    [$.substitution, $.solution],
  ],

  rules: {

    // =========================================================================
    // Top level
    // =========================================================================

    source_file: $ => $.proof,

    proof: $ => seq(
      $.header,
      optional($.proof_lines),
      $.footer,
    ),

    // The header line must not contain comments or newlines before its terminal
    // newline, so we capture it as a single opaque terminal (design decision 1).
    header: $ => /pseudo-Boolean proof version [0-9]+\.[0-9]+[ \t]*(\r\n|\n|\r)/,

    // =========================================================================
    // Footer
    // =========================================================================

    footer: $ => seq(
      $.output_stmt,
      $.conclusion_stmt,
      $.end_stmt,
    ),

    output_stmt: $ => seq(
      'output',
      choice(
        seq('NONE', ';'),
        seq($.output_guarantee, $.output_type, ';'),
      ),
    ),

    output_guarantee: $ => choice(
      'DERIVABLE',
      'EQUISATISFIABLE',
      'EQUIOPTIMAL',
      'EQUIENUMERABLE',
    ),

    output_type: $ => choice(
      'FILE',
      'IMPLICIT',
      seq('PERMUTATION', optional($.constraint_ids)),
    ),

    conclusion_stmt: $ => seq(
      'conclusion',
      $.conclusion_type,
      ';',
    ),

    conclusion_type: $ => choice(
      'NONE',
      seq('SAT', optional(seq(':', $.solution))),
      seq('UNSAT', optional(seq(':', $.constraint_id))),
      seq(
        'BOUNDS',
        field('lower', $.bound),
        optional(seq(':', $.constraint_id)),
        field('upper', $.bound),
        optional(seq(':', $.solution)),
      ),
      seq('ENUMERATION_COMPLETE', $.positive_integer, optional(seq(':', $.constraint_id))),
      seq('ENUMERATION_PARTIAL', $.positive_integer),
    ),

    bound: $ => choice($.signed_integer, 'INF'),

    end_stmt: $ => seq('end', 'pseudo-Boolean', 'proof', ';'),

    // =========================================================================
    // Proof lines
    // =========================================================================

    proof_lines: $ => repeat1($.proof_line),

    // A proof line is either a (possibly labelled) top-level rule followed by ';'.
    proof_line: $ => choice(
      seq($.top_rule, ';'),
      seq($.label, $.labeled_rule, ';'),
    ),

    // Rules that produce an output constraint and can therefore carry a label.
    labeled_rule: $ => choice(
      $.pol_rule,
      $.rup_rule,
      $.pbc_rule,
      $.e_rule,
      $.i_rule,
      $.ia_rule,
      $.a_rule,
      $.red_rule,
      $.dom_rule,
      $.soli_rule,
      $.obji_rule,
      $.solx_rule,
      $.preserved_add_rule,
      $.preserved_rm_rule,
    ),

    top_rule: $ => choice(
      // output (label-able) rules
      $.pol_rule,
      $.rup_rule,
      $.pbc_rule,
      $.e_rule,
      $.i_rule,
      $.ia_rule,
      $.a_rule,
      $.red_rule,
      $.dom_rule,
      $.soli_rule,
      $.obji_rule,
      $.solx_rule,
      $.preserved_add_rule,
      $.preserved_rm_rule,
      // non-output rules
      $.del_rule,
      $.delc_rule,
      $.deld_rule,
      $.obju_rule,
      $.load_order_rule,
      $.core_rule,
      $.setlvl_rule,
      $.wiplvl_rule,
      $.str_to_core_rule,
      $.sol_rule,
      $.def_order_rule,
      $.f_rule,
      $.eobj_rule,
      $.eord_def_rule,
      $.eord_loaded_rule,
      $.start_time_rule,
      $.end_time_rule,
      $.is_deleted_rule,
      $.fail_rule,
      $.epreserved_rule,
    ),

    // =========================================================================
    // pol — Reverse Polish Notation (design decision 2)
    // =========================================================================

    pol_rule: $ => seq('pol', repeat1($._pol_token)),

    _pol_token: $ => choice(
      $._pol_int_op,    // <positive_integer> <op>  e.g. `3 *`
      seq('0', choice('*', '-', 'c', 'd', 'm', 'n')),  // 0 is valid operand (e.g. 0 *)
      $.constraint_id,  // integer ID or @label
      $.literal,        // variable or ~variable (literal axiom push)
      '+',              // binary add
      's',              // saturate
      'w',              // weaken (preceded by a literal in the token stream)
    ),

    // Represents the two-token form `<positive_integer> <binary_op>` where
    // positive_integer is the operand (not a stack push).
    _pol_int_op: $ => seq(
      $.positive_integer,
      choice('*', '-', 'c', 'd', 'm', 'n'),
    ),

    // =========================================================================
    // rup — Reverse Unit Propagation
    // =========================================================================

    rup_rule: $ => seq(
      'rup',
      $.constraint,
      optional(seq(':', optional($.rup_hints))),
    ),

    rup_hints: $ => repeat1($.rup_hint),

    // '~' means "the negation of the constraint being derived"
    rup_hint: $ => choice('~', $.constraint_id),

    // =========================================================================
    // del / delc / deld
    // =========================================================================

    del_rule: $ => seq(
      'del',
      $.delete_type,
      optional($.witness_subproof_args),
    ),

    delete_type: $ => choice(
      seq('id',    optional($.constraint_ids)),
      seq('spec',  $.constraint),
      seq('range', $.constraint_id, $.constraint_id),
    ),

    delc_rule: $ => seq(
      'delc',
      optional($.constraint_ids),
      optional($.witness_subproof_args),
    ),

    deld_rule: $ => seq('deld', optional($.constraint_ids)),

    // =========================================================================
    // pbc — Proof by Contradiction
    // =========================================================================

    pbc_rule: $ => seq(
      'pbc',
      $.constraint,
      optional($.subproof_arg),
    ),

    // =========================================================================
    // red — Redundance-Based Strengthening
    // =========================================================================

    red_rule: $ => seq(
      'red',
      $.constraint,
      optional($.witness_subproof_args),
    ),

    // =========================================================================
    // dom — Dominance-Based Strengthening
    // =========================================================================

    dom_rule: $ => seq(
      'dom',
      $.constraint,
      $.witness_subproof_args,
    ),

    // =========================================================================
    // obju — Objective Update
    // =========================================================================

    obju_rule: $ => seq(
      'obju',
      choice('new', 'diff'),
      $.objective,
      optional($.subproof_arg),
    ),

    // =========================================================================
    // Preserved-set rules (extension beyond grammar.tex)
    // =========================================================================

    // preserved_add <variable> <constraint> [: subproof ... qed]
    preserved_add_rule: $ => seq(
      'preserved_add',
      field('variable', $.identifier),
      $.constraint,
      optional($.subproof_arg),
    ),

    // preserved_rm <variable> <constraint> [: subproof ... qed]
    preserved_rm_rule: $ => seq(
      'preserved_rm',
      field('variable', $.identifier),
      $.constraint,
      optional($.subproof_arg),
    ),

    // epreserved <variable>...
    epreserved_rule: $ => seq('epreserved', repeat1($.identifier)),

    // =========================================================================
    // f, e, eobj, i, ia, a, fail, is_deleted
    // =========================================================================

    f_rule:          $ => seq('f',          $.unsigned_integer),
    e_rule:          $ => seq('e',          $.constraint, optional(seq(':', $.constraint_id))),
    eobj_rule:       $ => seq('eobj',       $.objective),
    i_rule:          $ => seq('i',          $.constraint, optional(seq(':', $.constraint_id))),
    ia_rule:         $ => seq('ia',         $.constraint, optional(seq(':', $.constraint_id))),
    a_rule:          $ => seq('a',          $.constraint),
    is_deleted_rule: $ => seq('is_deleted', $.constraint),
    fail_rule:       $ => 'fail',

    // =========================================================================
    // setlvl, wiplvl, strengthening_to_core
    // =========================================================================

    setlvl_rule:      $ => seq('setlvl',               $.unsigned_integer),
    wiplvl_rule:      $ => seq('wiplvl',               $.unsigned_integer),
    str_to_core_rule: $ => seq('strengthening_to_core', choice('on', 'off')),

    // =========================================================================
    // sol, soli, obji, solx
    // =========================================================================

    sol_rule:  $ => seq('sol',  optional($.solution), optional(seq(':', $.signed_integer))),
    soli_rule: $ => seq('soli', optional($.solution), optional(seq(':', $.signed_integer))),
    obji_rule: $ => seq('obji', $.signed_integer),
    solx_rule: $ => seq('solx', optional($.solution)),

    // =========================================================================
    // load_order, core
    // =========================================================================

    load_order_rule: $ => seq(
      'load_order',
      optional(seq(field('name', $.identifier), optional($.literals))),
    ),

    core_rule: $ => seq('core', $.core_type),

    core_type: $ => choice(
      seq('id',    optional($.constraint_ids)),
      seq('range', $.constraint_id, $.constraint_id),
    ),

    // =========================================================================
    // start_time, end_time
    // =========================================================================

    start_time_rule: $ => seq('start_time', field('name', $.identifier)),
    end_time_rule:   $ => seq('end_time',   field('name', $.identifier)),

    // =========================================================================
    // eord_def, eord_loaded
    // =========================================================================

    eord_def_rule: $ => seq(
      'eord_def',
      field('name', $.identifier),
      $.order_vars,
      optional($.eord_def_spec),
      $.order_definition,
      'end', optional('eord_def'),
    ),

    eord_def_spec: $ => seq(
      'spec',
      optional($.constraint_lines),
      'end', optional('spec'), ';',
    ),

    eord_loaded_rule: $ => seq(
      'eord_loaded',
      optional(seq(field('name', $.identifier), optional($.literals))),
    ),

    // =========================================================================
    // def_order
    // =========================================================================

    def_order_rule: $ => seq(
      'def_order',
      field('name', $.identifier),
      $.order_vars,
      optional($.order_specification),
      $.order_definition,
      optional($.order_transitivity),
      optional($.order_reflexivity),
      'end', optional('def_order'),
    ),

    order_vars: $ => seq(
      'vars',
      'left',  optional($.variables), ';',
      'right', optional($.variables), ';',
      optional(seq('aux', optional($.aux_variables), ';')),
      'end', optional('vars'), ';',
    ),

    order_specification: $ => seq(
      'spec',
      optional($.specification_lines),
      'end', optional('spec'), ';',
    ),

    order_definition: $ => seq(
      'def',
      optional($.constraint_lines),
      'end', optional('def'), ';',
    ),

    order_transitivity: $ => seq(
      'transitivity',
      $.order_transitivity_vars,
      $.order_proof,
      'end', optional('transitivity'), ';',
    ),

    order_transitivity_vars: $ => seq(
      'vars',
      'fresh_right', optional($.variables), ';',
      optional(seq(
        'fresh_aux_1', optional($.aux_variables), ';',
        'fresh_aux_2', optional($.aux_variables), ';',
      )),
      'end', optional('vars'), ';',
    ),

    order_reflexivity: $ => seq(
      'reflexivity',
      $.order_proof,
      'end', optional('reflexivity'), ';',
    ),

    order_proof: $ => seq(
      'proof',
      optional($.subproof_lines),
      'qed', optional('proof'), ';',
    ),

    // =========================================================================
    // Specification lines (used inside order spec / eord_def_spec)
    // These allow all rules except top-only ones like def_order, del, core, etc.
    // =========================================================================

    specification_lines: $ => repeat1($.specification_line),

    specification_line: $ => choice(
      seq($.specification_rule, ';'),
      seq($.label, $.labeled_rule, ';'),
    ),

    // specification_rule = specification_output_rule | rule (grammar.tex)
    // specification_output_rule = output_rule | red_rule
    // rule = output_rule | f | eobj | eord_def | eord_loaded | start_time | end_time | is_deleted | fail
    specification_rule: $ => choice(
      $.pol_rule,
      $.rup_rule,
      $.pbc_rule,
      $.e_rule,
      $.i_rule,
      $.ia_rule,
      $.a_rule,
      $.red_rule,
      $.f_rule,
      $.eobj_rule,
      $.eord_def_rule,
      $.eord_loaded_rule,
      $.start_time_rule,
      $.end_time_rule,
      $.is_deleted_rule,
      $.fail_rule,
    ),

    // Constraint lines (inside order def / eord spec)
    constraint_lines: $ => repeat1($.constraint_line),
    constraint_line:  $ => seq($.constraint, ';'),

    // =========================================================================
    // Subproofs, scopes, proofgoals
    // =========================================================================

    subproof: $ => seq(
      'subproof',
      optional($.subproof_lines),
      'qed',
    ),

    subproof_lines: $ => repeat1($._subproof_line),

    _subproof_line: $ => choice(
      $.scope,
      $.proofgoal,
      $.proofgoal_line,
    ),

    scope: $ => seq(
      'scope',
      choice('geq', 'leq'),
      optional($.scope_lines),
      'end', optional('scope'), ';',
    ),

    scope_lines: $ => repeat1($._scope_line),

    _scope_line: $ => choice(
      $.proofgoal,
      $.proofgoal_line,
    ),

    proofgoal: $ => seq(
      'proofgoal',
      field('id', $.proofgoal_id),
      optional($.proofgoal_lines),
      'qed',
      optional(field('end_id', $.proofgoal_id)),
      optional(seq(':', $.constraint_id)),
      ';',
    ),

    proofgoal_lines: $ => repeat1($.proofgoal_line),

    proofgoal_line: $ => choice(
      seq($.proofgoal_rule, ';'),
      seq($.label, $.proofgoal_output_rule, ';'),
    ),

    // All rules valid inside a proofgoal (= `rule` in grammar.tex)
    proofgoal_rule: $ => choice(
      $.pol_rule,
      $.rup_rule,
      $.pbc_rule,
      $.e_rule,
      $.i_rule,
      $.ia_rule,
      $.a_rule,
      $.f_rule,
      $.eobj_rule,
      $.eord_def_rule,
      $.eord_loaded_rule,
      $.start_time_rule,
      $.end_time_rule,
      $.is_deleted_rule,
      $.fail_rule,
    ),

    // Output rules valid inside proofgoal (can take a label)
    proofgoal_output_rule: $ => choice(
      $.pol_rule,
      $.rup_rule,
      $.pbc_rule,
      $.e_rule,
      $.i_rule,
      $.ia_rule,
      $.a_rule,
    ),

    proofgoal_id: $ => choice(
      seq('#', $.positive_integer),
      $.constraint_id,
    ),

    // =========================================================================
    // Witness / subproof argument structure
    // =========================================================================

    // `: [substitution] [: subproof [rule_name] [: constraint_id]]`
    witness_subproof_args: $ => seq(
      ':',
      optional($.substitution),
      optional(seq(
        ':',
        $.subproof,
        optional($.subproof_end_name),
        optional(seq(':', $.constraint_id)),
      )),
    ),

    // `: subproof [rule_name] [: constraint_id]`
    subproof_arg: $ => seq(
      ':',
      $.subproof,
      optional($.subproof_end_name),
      optional(seq(':', $.constraint_id)),
    ),

    // Optional rule name that can follow `qed` inside a subproof to label which
    // rule's subproof is being closed.
    subproof_end_name: $ => choice('del', 'delc', 'pbc', 'red', 'dom', 'obju',
                                    'preserved_add', 'preserved_rm'),

    // =========================================================================
    // Constraints and objectives
    // =========================================================================

    // constraint ::= [reification] [sum] relop coefficient
    constraint: $ => seq(
      optional($.reification),
      optional($.sum),
      $.relational_operator,
      $.coefficient,
    ),

    // reification ::= literals '==>' | literal '<=='
    reification: $ => choice(
      seq($.literals, '==>'),
      seq($.literal, '<=='),
    ),

    relational_operator: $ => choice('>=', '<='),

    // objective ::= (sum [coefficient]) | coefficient
    // The trailing standalone coefficient is the constant term.
    objective: $ => choice(
      seq($.sum, optional($.coefficient)),
      $.coefficient,
    ),

    sum: $ => repeat1($.weighted_term),

    weighted_term: $ => seq($.coefficient, $.literal),

    coefficient: $ => $.signed_integer,

    // =========================================================================
    // Substitutions (witnesses)
    // =========================================================================

    // A sequence of (variable [->] (0 | 1 | literal)) pairs.
    substitution: $ => repeat1($.assignment),

    assignment: $ => seq(
      choice($.identifier, $.aux_variable),
      optional('->'),
      choice('0', '1', $.literal),
    ),

    // =========================================================================
    // Solutions
    // =========================================================================

    solution: $ => $.literals,

    // =========================================================================
    // Terminals: identifiers, literals, aux variables
    // =========================================================================

    // identifier: 1+ char, starts with letter/underscore; may contain ^ [ ] { } -
    // Used as the `word` terminal for keyword extraction, and as variable names,
    // order names, timer names, etc. throughout the grammar.
    // (Design decision 4: the semantic 2-char minimum for variables is not enforced
    // at the lexical level — that is a VeriPB semantic constraint, not a parsing one.)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_\^\[\]{}\-]*/,

    // aux_variable: starts with '$'
    aux_variable: $ => /\$[a-zA-Z0-9_\^\[\]{}\-]+/,

    // literal: optional '~' followed by identifier or aux_variable
    literal: $ => seq(optional('~'), choice($.identifier, $.aux_variable)),

    literals: $ => repeat1($.literal),

    // variables / aux_variables: named list rules used inside order definitions
    variables: $ => repeat1($.identifier),
    aux_variables: $ => repeat1($.aux_variable),

    // =========================================================================
    // Terminals: integers
    // =========================================================================

    // signed_integer: optional sign followed by unsigned integer
    // Used for coefficients and objective values.
    signed_integer: $ => token(seq(
      optional(/[+\-]/),
      /0|[1-9][0-9]*/,
    )),

    // unsigned_integer: non-negative integer (for f, setlvl, wiplvl, etc.)
    unsigned_integer: $ => /0|[1-9][0-9]*/,

    // positive_integer: strictly positive (for pol operands, proofgoal #N)
    positive_integer: $ => /[1-9][0-9]*/,

    // =========================================================================
    // Terminals: constraint IDs and labels
    // =========================================================================

    // constraint_id: a label or a non-zero integer (positive or negative).
    // No '+' prefix — that was VeriPB 2.0 syntax.
    constraint_id: $ => choice(
      $.label,
      $._neg_integer,
      $.positive_integer,
    ),

    // Negative non-zero integer (for constraint IDs only, not coefficients)
    _neg_integer: $ => token(/-[1-9][0-9]*/),

    constraint_ids: $ => repeat1($.constraint_id),

    // label: starts with '@' followed by identifier chars
    label: $ => /@[a-zA-Z0-9_\^\[\]{}\-]+/,

    // =========================================================================
    // Comments
    // =========================================================================

    comment: $ => /%[^\n\r]*/,

  },
});
