cmake_minimum_required(VERSION 3.21)
project(eco_qpp VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(eco_qpp SHARED src/qpp.cpp)
target_include_directories(eco_qpp PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)

add_library(eco_qpp::eco_qpp ALIAS eco_qpp)

install(TARGETS eco_qpp)
