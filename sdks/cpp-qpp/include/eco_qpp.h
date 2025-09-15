#pragma once

#include <cstdint>
#include <string>

namespace eco::qpp {
struct QuantumResult {
  double energy;
  double fidelity;
};

QuantumResult evaluate_expression(const std::string &source);
}
