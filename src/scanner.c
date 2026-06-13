#include "tree_sitter/parser.h"
#include <stddef.h>
#include <wctype.h>

// External token IDs (must match the order of `externals` in grammar.js).
enum TokenType {
    COMMENT_V2,
    POL_STAR,
};

// VeriPB 2.0 line comments and the pol multiplication operator both spell
// themselves with `*`. We disambiguate purely on column: a `*` that is the
// first non-whitespace character on its line is a comment (`comment_v2`); a
// `*` mid-line is the pol operator (`pol_star_op`). The bare `*` is not
// exposed as a regular lexer token, so the scanner is the only path that
// consumes it.
//
// Tree-sitter invokes the scanner either directly with `*` as the lookahead
// (when the regex-level lexer has nothing matching `*`) or — more commonly in
// practice — at the whitespace position preceding a `*`. Both entry points
// are handled below.

void *tree_sitter_veripb_external_scanner_create(void) { return NULL; }
void  tree_sitter_veripb_external_scanner_destroy(void *p) { (void)p; }
unsigned tree_sitter_veripb_external_scanner_serialize(void *p, char *buf) {
    (void)p; (void)buf; return 0;
}
void tree_sitter_veripb_external_scanner_deserialize(void *p, const char *buf, unsigned len) {
    (void)p; (void)buf; (void)len;
}

bool tree_sitter_veripb_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
    (void)payload;
    if (lexer->eof(lexer)) return false;

    // Direct path: scanner invoked while looking at a `*`.
    if (lexer->lookahead == '*') {
        if (lexer->get_column(lexer) == 0 && valid_symbols[COMMENT_V2]) {
            lexer->advance(lexer, false);
            while (lexer->lookahead != 0 &&
                   lexer->lookahead != '\n' &&
                   lexer->lookahead != '\r') {
                lexer->advance(lexer, false);
            }
            lexer->result_symbol = COMMENT_V2;
            lexer->mark_end(lexer);
            return true;
        }
        if (valid_symbols[POL_STAR]) {
            lexer->advance(lexer, false);
            lexer->result_symbol = POL_STAR;
            lexer->mark_end(lexer);
            return true;
        }
        return false;
    }

    // Indirect path: scanner invoked at whitespace preceding a `*`. Tree-sitter
    // does not always re-consult the scanner after the regular whitespace extra
    // consumes characters, so we have to peek past the whitespace ourselves.
    // The whitespace is skipped (skip=true) so it is not part of the produced
    // token's text.
    if (lexer->lookahead != ' '  && lexer->lookahead != '\t' &&
        lexer->lookahead != '\n' && lexer->lookahead != '\r') return false;

    bool saw_newline = false;
    while (lexer->lookahead == ' '  || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
        if (lexer->lookahead == '\n' || lexer->lookahead == '\r') saw_newline = true;
        lexer->advance(lexer, true);
    }
    if (lexer->lookahead != '*') return false;

    // If we crossed a newline before reaching the `*`, the `*` is the first
    // non-whitespace character on its line — that is a comment (any
    // indentation is allowed). Otherwise it is a mid-line pol operator.
    if (saw_newline && valid_symbols[COMMENT_V2]) {
        lexer->advance(lexer, false);
        while (lexer->lookahead != 0 &&
               lexer->lookahead != '\n' &&
               lexer->lookahead != '\r') {
            lexer->advance(lexer, false);
        }
        lexer->result_symbol = COMMENT_V2;
        lexer->mark_end(lexer);
        return true;
    }

    if (valid_symbols[POL_STAR]) {
        lexer->advance(lexer, false);
        lexer->result_symbol = POL_STAR;
        lexer->mark_end(lexer);
        return true;
    }

    return false;
}
