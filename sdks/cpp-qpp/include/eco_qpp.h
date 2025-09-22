#pragma once

#include <cstdint>
#include <memory>
#include <string>

namespace eco::qpp {
struct QuantumResult {
  double energy;
  double fidelity;
};

std::unique_ptr<QuantumResult> evaluate_expression(const std::string &source);
double qpp_energy(const QuantumResult &result);
double qpp_fidelity(const QuantumResult &result);
}
