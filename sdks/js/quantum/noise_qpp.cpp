#include <qpp/qpp.h>
#include <iostream>

int main() {
    using namespace qpp;
    // Prepare a single qubit in superposition
    ket state = 0_ket;
    state = gt.H * state;
    // Measure the qubit
    auto result = measure(state, 0);
    double freq = (std::get<RESULT>(result) == 0) ? 0.01 : 0.02;
    std::cout << freq << std::endl;
    return 0;
}
