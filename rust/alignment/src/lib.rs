use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn alignment_contract_version() -> u32 {
    2
}

/// Owned output: JavaScript copies the trace into a disjoint shared region.
#[wasm_bindgen]
pub struct TileOutput {
    boundaries: Vec<f32>,
    trace: Vec<u8>,
    best: Vec<f32>,
}

#[wasm_bindgen]
impl TileOutput {
    pub fn boundaries(&self) -> Vec<f32> {
        self.boundaries.clone()
    }
    pub fn trace(&self) -> Vec<u8> {
        self.trace.clone()
    }
    pub fn best(&self) -> Vec<f32> {
        self.best.clone()
    }
}

/// Gotoh cells with interleaved M/X/Y boundaries and stable tie ordering.
#[wasm_bindgen]
pub fn calculate_tile(
    first: &[u8],
    second: &[u8],
    scores: &[f32],
    alphabet_size: usize,
    top: &[f32],
    left: &[f32],
    local: bool,
    last_row: bool,
    last_column: bool,
) -> Result<TileOutput, JsError> {
    let h = first.len();
    let w = second.len();
    if h == 0
        || w == 0
        || h > 256
        || w > 256
        || alphabet_size == 0
        || alphabet_size > 256
        || scores.len() != alphabet_size * alphabet_size
        || top.len() != (w + 1) * 3
        || left.len() != (h + 1) * 3
        || first
            .iter()
            .chain(second)
            .any(|&v| v as usize >= alphabet_size)
        || top
            .iter()
            .chain(left)
            .any(|v| v.is_nan() || *v == f32::INFINITY)
        || scores.iter().any(|v| !v.is_finite())
    {
        return Err(JsError::new("Invalid alignment tile input"));
    }
    let mut previous = top.to_vec();
    let mut current = vec![0.0; top.len()];
    let mut right = vec![0.0; left.len()];
    right[..3].copy_from_slice(&top[w * 3..w * 3 + 3]);
    let mut trace = vec![0; h * w];
    let mut best = vec![0.0; 4];
    for i in 1..=h {
        current[..3].copy_from_slice(&left[i * 3..i * 3 + 3]);
        for j in 1..=w {
            let p = j * 3;
            let mut diagonal = previous[p - 3];
            let mut origin = 0;
            for state in 1..3 {
                if previous[p - 3 + state] > diagonal {
                    diagonal = previous[p - 3 + state];
                    origin = state as u8;
                }
            }
            let mut m =
                diagonal + scores[first[i - 1] as usize * alphabet_size + second[j - 1] as usize];
            if local && m <= 0.0 {
                m = 0.0;
                origin = 3;
            }
            let open_x = previous[p] - 10.0;
            let extend_x = previous[p + 1] - 0.5;
            let open_y = current[p - 3] - 10.0;
            let extend_y = current[p - 1] - 0.5;
            current[p] = m;
            current[p + 1] = open_x.max(extend_x);
            current[p + 2] = open_y.max(extend_y);
            trace[(i - 1) * w + j - 1] = origin
                | if extend_x > open_x { 4 } else { 0 }
                | if extend_y > open_y { 8 } else { 0 };
            if local || (last_row && i == h) || (last_column && j == w) {
                for state in 0..3 {
                    if current[p + state] > best[0] {
                        best = vec![current[p + state], i as f32, j as f32, state as f32];
                    }
                }
            }
        }
        right[i * 3..i * 3 + 3].copy_from_slice(&current[w * 3..w * 3 + 3]);
        std::mem::swap(&mut previous, &mut current);
    }
    previous.extend(right);
    Ok(TileOutput {
        boundaries: previous,
        trace,
        best,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Biopython 1.87 fixtures shared with the TypeScript tests, so both kernels check the same figures.
    const BLOSUM: &str = include_str!("../../../src/features/alignment/fixtures/blosum.json");
    const BIOPYTHON: &str = include_str!("../../../src/features/alignment/fixtures/biopython.json");
    const NEG: f32 = f32::NEG_INFINITY;

    /// Raw value after `"key":` in a flat fixture object, without quotes.
    fn field<'a>(text: &'a str, key: &str) -> &'a str {
        let pattern = format!("\"{key}\":");
        let start = text.find(&pattern).expect("fixture key") + pattern.len();
        let rest = text[start..].trim_start();
        match rest.strip_prefix('"') {
            Some(quoted) => &quoted[..quoted.find('"').expect("closing quote")],
            None => rest[..rest.find([',', '}', '\n']).unwrap_or(rest.len())].trim(),
        }
    }

    fn alphabet() -> &'static str {
        field(BLOSUM, "alphabet")
    }

    /// Row-major substitution matrix, as `wasm.ts` flattens it.
    fn matrix(name: &str) -> Vec<f32> {
        let pattern = format!("\"{name}\":");
        let start = BLOSUM.find(&pattern).expect("matrix") + pattern.len();
        let (mut depth, mut number, mut values) = (0, String::new(), Vec::new());
        for c in BLOSUM[start..].chars() {
            match c {
                '-' | '.' | '0'..='9' => number.push(c),
                '[' => depth += 1,
                ',' | ']' => {
                    if !number.is_empty() {
                        values.push(number.parse().expect("matrix value"));
                        number.clear();
                    }
                    if c == ']' {
                        depth -= 1;
                        if depth == 0 {
                            break;
                        }
                    }
                }
                _ => {}
            }
        }
        assert_eq!(values.len(), alphabet().len().pow(2));
        values
    }

    /// Mirrors `wasm.ts`: `indexOf` returns -1 for a foreign residue, which a Uint8Array stores as 255.
    fn encode(sequence: &str) -> Vec<u8> {
        sequence
            .chars()
            .map(|residue| {
                alphabet()
                    .find(residue)
                    .map_or(u8::MAX, |index| index as u8)
            })
            .collect()
    }

    /// Free terminal gaps and local restarts, as `initialBoundary` in `tile.ts`.
    fn free_boundary(length: usize) -> Vec<f32> {
        [0.0, NEG, NEG].repeat(length + 1)
    }

    fn tile(first: &str, second: &str, name: &str, local: bool) -> TileOutput {
        let (a, b) = (encode(first), encode(second));
        calculate_tile(
            &a,
            &b,
            &matrix(name),
            alphabet().len(),
            &free_boundary(b.len()),
            &free_boundary(a.len()),
            local,
            true,
            true,
        )
        .unwrap_or_else(|_| panic!("valid tile rejected"))
    }

    /// Port of `buildResult` in `gotoh.ts`; kernel cell (i - 1, j - 1) is matrix cell (i, j).
    fn traceback(first: &str, second: &str, output: &TileOutput, local: bool) -> (String, String) {
        let (a, b) = (first.as_bytes(), second.as_bytes());
        let (trace, best) = (output.trace(), output.best());
        let (mut i, mut j, mut state) = (best[1] as usize, best[2] as usize, best[3] as u8);
        let (mut top, mut bottom) = (Vec::new(), Vec::new());
        if !local {
            for k in (i..a.len()).rev() {
                top.push(a[k]);
                bottom.push(b'-');
            }
            for k in (j..b.len()).rev() {
                top.push(b'-');
                bottom.push(b[k]);
            }
        }
        while i > 0 && j > 0 {
            let code = trace[(i - 1) * b.len() + j - 1];
            match state {
                0 => {
                    if local && code & 3 == 3 {
                        break;
                    }
                    top.push(a[i - 1]);
                    bottom.push(b[j - 1]);
                    (i, j, state) = (i - 1, j - 1, code & 3);
                }
                1 => {
                    top.push(a[i - 1]);
                    bottom.push(b'-');
                    (i, state) = (i - 1, if code & 4 != 0 { 1 } else { 0 });
                }
                _ => {
                    top.push(b'-');
                    bottom.push(b[j - 1]);
                    (j, state) = (j - 1, if code & 8 != 0 { 2 } else { 0 });
                }
            }
        }
        if !local {
            while i > 0 {
                i -= 1;
                top.push(a[i]);
                bottom.push(b'-');
            }
            while j > 0 {
                j -= 1;
                top.push(b'-');
                bottom.push(b[j]);
            }
        }
        top.reverse();
        bottom.reverse();
        (
            String::from_utf8(top).unwrap(),
            String::from_utf8(bottom).unwrap(),
        )
    }

    #[test]
    fn reports_the_contract_checked_by_the_loader() {
        assert_eq!(alignment_contract_version(), 2);
    }

    #[test]
    fn matches_biopython_for_free_ends_and_local_cases() {
        let mut checked = 0;
        for case in BIOPYTHON.split('{').skip(2) {
            // The kernel always leaves terminal gaps free; the penalized-ends case only checks the TS reference.
            let local = field(case, "mode") == "local";
            if !local && field(case, "freeEnds") != "true" {
                continue;
            }
            let (first, second) = (field(case, "first"), field(case, "second"));
            let output = tile(first, second, field(case, "matrix"), local);
            let score: f32 = field(case, "score").parse().unwrap();
            assert_eq!(output.best()[0], score, "{}", field(case, "name"));
            let aligned = traceback(first, second, &output, local);
            assert_eq!(aligned.0, field(case, "alignedFirst"));
            assert_eq!(aligned.1, field(case, "alignedSecond"));
            checked += 1;
        }
        assert_eq!(checked, 4);
    }

    #[test]
    fn scores_identical_sequences_along_the_diagonal() {
        // BLOSUM62 diagonal for A C D E F G H I K: 4 + 9 + 6 + 5 + 6 + 6 + 8 + 4 + 5 = 53, no gaps.
        let sequence = "ACDEFGHIK";
        for local in [false, true] {
            let output = tile(sequence, sequence, "BLOSUM62", local);
            assert_eq!(output.best(), vec![53.0, 9.0, 9.0, 0.0]);
            let trace = output.trace();
            for k in 1..sequence.len() {
                assert_eq!(
                    trace[k * sequence.len() + k] & 3,
                    0,
                    "diagonal comes from M"
                );
            }
            let aligned = traceback(sequence, sequence, &output, local);
            assert_eq!(aligned, (sequence.to_owned(), sequence.to_owned()));
        }
    }

    #[test]
    fn aligns_one_residue_and_exports_its_boundaries() {
        // W/W = 11 in BLOSUM62. Gaps opened against the zero free-end boundary cost 10, so X = Y = 0 - 10.
        let output = tile("W", "W", "BLOSUM62", false);
        assert_eq!(output.best(), vec![11.0, 1.0, 1.0, 0.0]);
        assert_eq!(output.trace(), vec![0]);
        // Bottom row (corner, cell) followed by the right column (corner, cell), M/X/Y interleaved.
        let cell = [11.0, -10.0, -10.0];
        assert_eq!(
            output.boundaries(),
            [[0.0, NEG, NEG], cell, [0.0, NEG, NEG], cell].concat()
        );
    }

    #[test]
    fn leaves_a_mismatch_to_the_all_gap_alignment() {
        // W/A = -3 in BLOSUM62. With free terminal gaps the empty pairing (score 0) wins, so no best
        // cell is reported and the caller aligns both residues against gaps.
        let global = tile("W", "A", "BLOSUM62", false);
        assert_eq!(global.best(), vec![0.0; 4]);
        assert_eq!(global.trace(), vec![0]);
        assert_eq!(global.boundaries()[3], -3.0);
        // Local mode clamps the cell to 0 and marks it as a restart (origin 3).
        let local = tile("W", "A", "BLOSUM62", true);
        assert_eq!(local.best(), vec![0.0; 4]);
        assert_eq!(local.trace(), vec![3]);
        assert_eq!(local.boundaries()[3], 0.0);
    }

    #[test]
    fn opens_once_and_extends_an_internal_gap() {
        // Six W/W pairs (6 x 11 = 66) around a two-residue gap: 66 - (open 10 + extend 0.5) = 55.5.
        // Pairing the two A with W (-3 each) instead scores at most 4 x 11 - 6 = 38.
        let (long, short) = ("WWWAAWWW", "WWWWWW");
        let output = tile(long, short, "BLOSUM62", false);
        assert_eq!(output.best(), vec![55.5, 8.0, 6.0, 0.0]);
        let trace = output.trace();
        // X at matrix cell (4, 3) opens the gap, (5, 3) extends it and M at (6, 4) resumes from X.
        assert_eq!(trace[3 * 6 + 2] & 4, 0);
        assert_eq!(trace[4 * 6 + 2] & 4, 4);
        assert_eq!(trace[5 * 6 + 3] & 3, 1);
        assert_eq!(
            traceback(long, short, &output, false),
            (long.into(), "WWW--WWW".into())
        );
        // Swapping the sequences moves the same gap to Y with the same score.
        let swapped = tile(short, long, "BLOSUM62", false);
        assert_eq!(swapped.best(), vec![55.5, 6.0, 8.0, 0.0]);
        assert_eq!(swapped.trace()[2 * 8 + 4] & 8, 8);
        assert_eq!(
            traceback(short, long, &swapped, false),
            ("WWW--WWW".into(), long.into())
        );
    }

    #[test]
    fn chains_tiles_through_their_boundaries() {
        // Splitting the Biopython internal_gap case into two column tiles keeps its score of 38.
        let (a, b) = (encode("ACDEFGHIK"), encode("ACDFGHIK"));
        let (scores, size) = (matrix("BLOSUM62"), alphabet().len());
        let run = |second: &[u8], left: &[f32], last_column| {
            calculate_tile(
                &a,
                second,
                &scores,
                size,
                &free_boundary(4),
                left,
                false,
                true,
                last_column,
            )
            .unwrap_or_else(|_| panic!("valid tile rejected"))
        };
        let first_half = run(&b[..4], &free_boundary(a.len()), false);
        let right_edge = first_half.boundaries()[5 * 3..].to_vec();
        let second_half = run(&b[4..], &right_edge, true);
        let whole = tile("ACDEFGHIK", "ACDFGHIK", "BLOSUM62", false);
        assert_eq!(second_half.best()[0], 38.0);
        assert!(first_half.best()[0] < 38.0);
        assert_eq!(
            &whole.boundaries()[..27][12..],
            &second_half.boundaries()[..15]
        );
        for i in 0..a.len() {
            assert_eq!(
                &whole.trace()[i * 8 + 4..i * 8 + 8],
                &second_half.trace()[i * 4..i * 4 + 4]
            );
        }
    }

    struct Input {
        first: Vec<u8>,
        second: Vec<u8>,
        scores: Vec<f32>,
        alphabet_size: usize,
        top: Vec<f32>,
        left: Vec<f32>,
    }

    impl Input {
        fn new(first: &str, second: &str) -> Self {
            let (first, second) = (encode(first), encode(second));
            Self {
                top: free_boundary(second.len()),
                left: free_boundary(first.len()),
                first,
                second,
                scores: matrix("BLOSUM62"),
                alphabet_size: alphabet().len(),
            }
        }

        /// Outside wasm32, `JsError::new` calls a wasm-bindgen import whose native stub panics,
        /// so a rejection shows as that panic rather than an `Err` or an indexing panic.
        fn rejected(&self) -> bool {
            let outcome = std::panic::catch_unwind(|| {
                calculate_tile(
                    &self.first,
                    &self.second,
                    &self.scores,
                    self.alphabet_size,
                    &self.top,
                    &self.left,
                    false,
                    true,
                    true,
                )
                .is_ok()
            });
            match outcome {
                Ok(accepted) => !accepted,
                Err(payload) => {
                    let message = payload
                        .downcast_ref::<&str>()
                        .copied()
                        .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
                        .unwrap_or_default();
                    assert!(
                        message.contains("imported functions on non-wasm targets"),
                        "unexpected panic: {message}"
                    );
                    true
                }
            }
        }
    }

    #[test]
    fn accepts_full_tiles_and_negative_infinite_boundaries() {
        assert!(!Input::new("A", "C").rejected());
        let edge = "A".repeat(256);
        assert!(!Input::new(&edge, &edge).rejected());
    }

    #[test]
    fn rejects_empty_and_oversized_tiles() {
        assert!(Input::new("", "A").rejected());
        assert!(Input::new("A", "").rejected());
        assert!(Input::new(&"A".repeat(257), "A").rejected());
        assert!(Input::new("A", &"A".repeat(257)).rejected());
    }

    #[test]
    fn rejects_residues_outside_the_alphabet() {
        // `normalizeForAlignment` maps U to C and O to K before encoding; unmapped they, like any
        // foreign symbol, arrive as 255 and must not be scored.
        assert!(!alphabet().contains(['U', 'O']));
        for residue in ["U", "O", "J", "*", "-", "a"] {
            assert!(Input::new(residue, "A").rejected(), "{residue}");
            assert!(Input::new("A", residue).rejected(), "{residue}");
        }
        let mut input = Input::new("A", "C");
        input.second = vec![alphabet().len() as u8];
        assert!(input.rejected());
    }

    #[test]
    fn rejects_inconsistent_matrix_and_boundary_shapes() {
        let mut input = Input::new("AC", "DE");
        input.scores.pop();
        assert!(input.rejected());
        for size in [0, 257] {
            let mut input = Input::new("AC", "DE");
            input.alphabet_size = size;
            input.scores = vec![0.0; size * size];
            assert!(input.rejected(), "{size}");
        }
        let mut input = Input::new("AC", "DE");
        input.top.push(0.0);
        assert!(input.rejected());
        let mut input = Input::new("AC", "DE");
        input.left.truncate(6);
        assert!(input.rejected());
    }

    #[test]
    fn rejects_non_finite_scores_and_invalid_boundaries() {
        for value in [f32::NAN, f32::INFINITY, NEG] {
            let mut input = Input::new("AC", "DE");
            input.scores[0] = value;
            assert!(input.rejected(), "score {value}");
        }
        for value in [f32::NAN, f32::INFINITY] {
            let mut input = Input::new("AC", "DE");
            input.top[3] = value;
            assert!(input.rejected(), "top {value}");
            let mut input = Input::new("AC", "DE");
            input.left[4] = value;
            assert!(input.rejected(), "left {value}");
        }
    }
}
