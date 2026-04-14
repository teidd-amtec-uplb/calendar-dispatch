// lib/amats-machine-tests.ts
// Canonical mapping of AMaTS machines to their available tests.
// Source: AMaTS Machine Testing and Studies Laboratory document.

export interface MachineTestConfig {
  machine: string;
  tests: string[];
}

export const AMATS_MACHINE_TESTS: MachineTestConfig[] = [
  {
    machine: "Internal Combustion Engine",
    tests: [
      "Maximum power test",
      "Varying load test",
      "Varying speed test",
      "Continuous running test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Walking-Type Agricultural Tractor",
    tests: [
      "Varying load test",
      "Continuous running test",
      "Transmission efficiency test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Four-wheel Tractor",
    tests: [
      "Maximum power test",
      "Test at full load and varying speed",
      "Hydraulic power and lifting force test",
      "Turning radius test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Centrifugal Pump",
    tests: [
      "Performance test",
      "Cavitation test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Agricultural and Fishery Pumpset",
    tests: [
      "Performance test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Knapsack Sprayer",
    tests: [
      "Initial Assessment",
      "Volumetric efficiency test",
      "Actual volume discharge per stroke determination",
      "Leak test",
      "Tilt and inversion test",
      "Discharge test",
      "Spray angle determination",
      "Measuring spray droplet size",
      "Cut-off Valve Reliability test",
      "Pressure test",
      "Continuous running test",
      "Strap drop test",
      "Drop test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Agricultural Power Sprayer",
    tests: [
      "Discharge test",
      "Spray range test",
      "Spray quality test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Mist Blower",
    tests: [
      "Performance test",
      "Air velocity test",
      "Discharge test",
      "Range and width test",
      "Droplet test",
      "Seed broadcaster test",
      "Fertilizer applicator test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Brush Cutter",
    tests: [
      "Performance test",
      "Verification of machine specification/Photo documentation",
    ],
  },
  {
    machine: "Solar-Powered Irrigation System",
    tests: [
      "Performance test",
      "Verification of machine specification/Photo documentation",
    ],
  },
];

/** Returns all machine names for the dropdown. */
export function getMachineNames(): string[] {
  return AMATS_MACHINE_TESTS.map((m) => m.machine);
}

/** Returns tests for a given machine name, or [] if not found. */
export function getTestsForMachine(machineName: string): string[] {
  return (
    AMATS_MACHINE_TESTS.find((m) => m.machine === machineName)?.tests ?? []
  );
}
