#[cxx::bridge]
mod ffi {
    unsafe extern "C++" {
        include!("eco_qpp.h");

        #[namespace = "eco::qpp"]
        type QuantumResult;

        #[namespace = "eco::qpp"]
        fn evaluate_expression(source: &CxxString) -> UniquePtr<QuantumResult>;

        #[namespace = "eco::qpp"]
        fn qpp_energy(result: &QuantumResult) -> f64;

        #[namespace = "eco::qpp"]
        fn qpp_fidelity(result: &QuantumResult) -> f64;
    }
}

pub struct QuantumEvaluation {
    pub energy: f64,
    pub fidelity: f64,
}

pub fn evaluate_expression(source: &str) -> Result<QuantumEvaluation, cxx::Exception> {
    cxx::let_cxx_string!(cxx_source = source);
    let result = ffi::evaluate_expression(&cxx_source);
    let result_ref = result
        .as_ref()
        .expect("quantum evaluation returned null pointer");
    let energy = ffi::qpp_energy(result_ref);
    let fidelity = ffi::qpp_fidelity(result_ref);
    Ok(QuantumEvaluation { energy, fidelity })
}
