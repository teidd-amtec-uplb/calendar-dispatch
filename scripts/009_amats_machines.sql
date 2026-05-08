-- 009_amats_machines.sql
-- Create dynamic amats_machines table and migrate existing static data

CREATE TABLE IF NOT EXISTS amats_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine TEXT NOT NULL UNIQUE,
  tests TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert existing machines and tests if the table is empty
INSERT INTO amats_machines (machine, tests)
SELECT machine, tests FROM (
  VALUES 
    ('Internal Combustion Engine', ARRAY[
      'Maximum power test',
      'Varying load test',
      'Varying speed test',
      'Continuous running test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Walking-Type Agricultural Tractor', ARRAY[
      'Varying load test',
      'Continuous running test',
      'Transmission efficiency test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Four-wheel Tractor', ARRAY[
      'Maximum power test',
      'Test at full load and varying speed',
      'Hydraulic power and lifting force test',
      'Turning radius test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Centrifugal Pump', ARRAY[
      'Performance test',
      'Cavitation test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Agricultural and Fishery Pumpset', ARRAY[
      'Performance test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Knapsack Sprayer', ARRAY[
      'Initial Assessment',
      'Volumetric efficiency test',
      'Actual volume discharge per stroke determination',
      'Leak test',
      'Tilt and inversion test',
      'Discharge test',
      'Spray angle determination',
      'Measuring spray droplet size',
      'Cut-off Valve Reliability test',
      'Pressure test',
      'Continuous running test',
      'Strap drop test',
      'Drop test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Agricultural Power Sprayer', ARRAY[
      'Discharge test',
      'Spray range test',
      'Spray quality test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Mist Blower', ARRAY[
      'Performance test',
      'Air velocity test',
      'Discharge test',
      'Range and width test',
      'Droplet test',
      'Seed broadcaster test',
      'Fertilizer applicator test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Brush Cutter', ARRAY[
      'Performance test',
      'Verification of machine specification/Photo documentation'
    ]),
    ('Solar-Powered Irrigation System', ARRAY[
      'Performance test',
      'Verification of machine specification/Photo documentation'
    ])
) AS v(machine, tests)
ON CONFLICT (machine) DO NOTHING;
