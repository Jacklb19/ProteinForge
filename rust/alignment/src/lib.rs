use wasm_bindgen::prelude::*;

/// Identifies the initial JavaScript boundary before the S4 algorithm port.
#[wasm_bindgen]
pub fn alignment_contract_version() -> u32 {
    1
}
