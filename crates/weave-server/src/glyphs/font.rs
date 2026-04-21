//! Programmatic glyph set: letters `A`-`Z` (5x7 centered in 9x9) and
//! numbers `00`-`99` (two 3x5 digits laid out side-by-side in 9x9). These
//! are seeded into the weave glyph registry on every startup so Web UI +
//! edge-agents share a consistent alphabet for candidate labels.
//!
//! Row format matches `weave_contracts::Glyph.pattern`: 9 lines of 9
//! chars, `*` = LED on, anything else = off.

use weave_contracts::Glyph;

const GRID: usize = 9;

/// 5x7 letter cell: 7 rows of 5 chars. `*` = on, `.` = off.
type LetterCell = [&'static str; 7];

/// 3x5 digit cell: 5 rows of 3 chars.
type DigitCell = [&'static str; 5];

#[rustfmt::skip]
const LETTERS: &[(char, LetterCell)] = &[
    ('A', [".***.", "*...*", "*...*", "*****", "*...*", "*...*", "*...*"]),
    ('B', ["****.", "*...*", "*...*", "****.", "*...*", "*...*", "****."]),
    ('C', [".****", "*....", "*....", "*....", "*....", "*....", ".****"]),
    ('D', ["****.", "*...*", "*...*", "*...*", "*...*", "*...*", "****."]),
    ('E', ["*****", "*....", "*....", "****.", "*....", "*....", "*****"]),
    ('F', ["*****", "*....", "*....", "****.", "*....", "*....", "*...."]),
    ('G', [".****", "*....", "*....", "*..**", "*...*", "*...*", ".****"]),
    ('H', ["*...*", "*...*", "*...*", "*****", "*...*", "*...*", "*...*"]),
    ('I', ["*****", "..*..", "..*..", "..*..", "..*..", "..*..", "*****"]),
    ('J', ["..***", "...*.", "...*.", "...*.", "...*.", "*..*.", ".**.."]),
    ('K', ["*...*", "*..*.", "*.*..", "**...", "*.*..", "*..*.", "*...*"]),
    ('L', ["*....", "*....", "*....", "*....", "*....", "*....", "*****"]),
    ('M', ["*...*", "**.**", "*.*.*", "*.*.*", "*...*", "*...*", "*...*"]),
    ('N', ["*...*", "**..*", "*.*.*", "*.*.*", "*.*.*", "*..**", "*...*"]),
    ('O', [".***.", "*...*", "*...*", "*...*", "*...*", "*...*", ".***."]),
    ('P', ["****.", "*...*", "*...*", "****.", "*....", "*....", "*...."]),
    ('Q', [".***.", "*...*", "*...*", "*...*", "*.*.*", "*..*.", ".**.*"]),
    ('R', ["****.", "*...*", "*...*", "****.", "*.*..", "*..*.", "*...*"]),
    ('S', [".****", "*....", "*....", ".***.", "....*", "....*", "****."]),
    ('T', ["*****", "..*..", "..*..", "..*..", "..*..", "..*..", "..*.."]),
    ('U', ["*...*", "*...*", "*...*", "*...*", "*...*", "*...*", ".***."]),
    ('V', ["*...*", "*...*", "*...*", "*...*", "*...*", ".*.*.", "..*.."]),
    ('W', ["*...*", "*...*", "*...*", "*.*.*", "*.*.*", "*.*.*", ".*.*."]),
    ('X', ["*...*", "*...*", ".*.*.", "..*..", ".*.*.", "*...*", "*...*"]),
    ('Y', ["*...*", "*...*", ".*.*.", "..*..", "..*..", "..*..", "..*.."]),
    ('Z', ["*****", "....*", "...*.", "..*..", ".*...", "*....", "*****"]),
];

#[rustfmt::skip]
const DIGITS: &[DigitCell; 10] = &[
    ["***", "*.*", "*.*", "*.*", "***"], // 0
    [".*.", "**.", ".*.", ".*.", "***"], // 1
    ["***", "..*", "***", "*..", "***"], // 2
    ["***", "..*", ".**", "..*", "***"], // 3
    ["*.*", "*.*", "***", "..*", "..*"], // 4
    ["***", "*..", "***", "..*", "***"], // 5
    ["***", "*..", "***", "*.*", "***"], // 6
    ["***", "..*", "..*", "..*", "..*"], // 7
    ["***", "*.*", "***", "*.*", "***"], // 8
    ["***", "*.*", "***", "..*", "***"], // 9
];

/// Render a letter into a 9x9 pattern string. 5x7 cell centred: rows 1-7,
/// cols 2-6 hold the letter; the rest is background.
fn render_letter(cell: &LetterCell) -> String {
    let mut rows: [[char; GRID]; GRID] = [[' '; GRID]; GRID];
    for (r_idx, row) in cell.iter().enumerate() {
        for (c_idx, ch) in row.chars().enumerate() {
            if ch == '*' {
                rows[1 + r_idx][2 + c_idx] = '*';
            }
        }
    }
    join_grid(&rows)
}

/// Render a pair of digits (`n` in 0..=99) into a 9x9 pattern. Layout:
/// rows 2-6 (5 rows), cols 1-3 (hi digit) + col 4 gap + cols 5-7 (lo).
fn render_digit_pair(n: u8) -> String {
    let hi = (n / 10) as usize;
    let lo = (n % 10) as usize;
    let mut rows: [[char; GRID]; GRID] = [[' '; GRID]; GRID];
    place_digit(&mut rows, &DIGITS[hi], 1);
    place_digit(&mut rows, &DIGITS[lo], 5);
    join_grid(&rows)
}

fn place_digit(rows: &mut [[char; GRID]; GRID], cell: &DigitCell, col_start: usize) {
    for (r_idx, row) in cell.iter().enumerate() {
        for (c_idx, ch) in row.chars().enumerate() {
            if ch == '*' {
                rows[2 + r_idx][col_start + c_idx] = '*';
            }
        }
    }
}

fn join_grid(rows: &[[char; GRID]; GRID]) -> String {
    let mut out = String::with_capacity(GRID * (GRID + 1));
    for (i, row) in rows.iter().enumerate() {
        out.extend(row.iter());
        if i + 1 < GRID {
            out.push('\n');
        }
    }
    out
}

/// All programmatically generated glyphs: 26 letters + 100 digit pairs.
pub fn generated_set() -> Vec<Glyph> {
    let mut out = Vec::with_capacity(LETTERS.len() + 100);
    for (c, cell) in LETTERS.iter() {
        out.push(Glyph {
            name: c.to_string(),
            pattern: render_letter(cell),
            builtin: false,
        });
    }
    for n in 0u8..=99u8 {
        out.push(Glyph {
            name: format!("{:02}", n),
            pattern: render_digit_pair(n),
            builtin: false,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn letter_a_has_expected_shape() {
        let a = render_letter(&LETTERS[0].1);
        // 9 rows, 9 cols each, \n-separated.
        let lines: Vec<_> = a.lines().collect();
        assert_eq!(lines.len(), 9);
        for line in &lines {
            assert_eq!(line.chars().count(), 9);
        }
        // Row 0 and 8 are blank padding.
        assert_eq!(lines[0], "         ");
        assert_eq!(lines[8], "         ");
        // Row 4 is the A crossbar: all 5 cells at cols 2-6 lit.
        assert_eq!(lines[4], "  *****  ");
    }

    #[test]
    fn digit_pair_42_renders_4_then_2() {
        let s = render_digit_pair(42);
        let lines: Vec<_> = s.lines().collect();
        assert_eq!(lines.len(), 9);
        // Top 2 rows + bottom 2 rows are padding.
        for i in [0, 1, 7, 8] {
            assert_eq!(lines[i], "         ");
        }
        // Row 4 (middle row of digit cell = index 2 of DIGITS):
        //   hi=4: ***  lo=2: ***
        // Positioned at col 1-3 and col 5-7.
        assert_eq!(lines[4], " *** *** ");
    }

    #[test]
    fn generated_set_has_26_letters_and_100_numbers() {
        let s = generated_set();
        assert_eq!(s.len(), 26 + 100);
        assert!(s.iter().any(|g| g.name == "A"));
        assert!(s.iter().any(|g| g.name == "Z"));
        assert!(s.iter().any(|g| g.name == "00"));
        assert!(s.iter().any(|g| g.name == "99"));
    }

    #[test]
    fn all_patterns_are_9x9_shape() {
        for g in generated_set() {
            let lines: Vec<_> = g.pattern.lines().collect();
            assert_eq!(lines.len(), 9, "{}: wrong row count", g.name);
            for (r, line) in lines.iter().enumerate() {
                assert_eq!(line.chars().count(), 9, "{}: row {} wrong width", g.name, r);
            }
        }
    }
}
