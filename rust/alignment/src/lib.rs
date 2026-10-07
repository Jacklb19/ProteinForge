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
