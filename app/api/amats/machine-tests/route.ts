// app/api/amats/machine-tests/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getTestsForMachine,
  getMachineNames,
} from "@/lib/amats-machine-tests";

export async function GET(req: NextRequest) {
  const machine = req.nextUrl.searchParams.get("machine");

  // No machine param → return all machine names
  if (!machine) {
    return NextResponse.json({ machines: getMachineNames() });
  }

  const tests = getTestsForMachine(machine);
  if (tests.length === 0) {
    return NextResponse.json(
      { error: "Machine not found", tests: [] },
      { status: 404 }
    );
  }

  return NextResponse.json({ machine, tests });
}
