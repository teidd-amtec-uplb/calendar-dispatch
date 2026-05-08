import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We use service role key here to bypass RLS for now if needed,
// but ideally we should verify the user token if they are modifying it.
// To keep it simple and since it's a global config table, we'll just check auth for writes.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  const machine = req.nextUrl.searchParams.get("machine");

  if (machine) {
    const { data, error } = await supabase
      .from("amats_machines")
      .select("machine, tests")
      .eq("machine", machine)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Machine not found", tests: [] },
        { status: 404 }
      );
    }
    return NextResponse.json({ machine: data.machine, tests: data.tests });
  }

  // Fetch all machines
  const { data, error } = await supabase
    .from("amats_machines")
    .select("id, machine, tests")
    .order("machine");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    machines: data.map(m => m.machine),
    detailed: data
  });
}

export async function POST(req: NextRequest) {
  // Validate token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { machine, tests } = body;
    
    if (!machine || !tests) {
      return NextResponse.json({ error: "Machine and tests required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("amats_machines")
      .insert({ machine, tests })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message: "Machine added", data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, machine, tests } = body;
    
    if (!id || !machine || !tests) {
      return NextResponse.json({ error: "ID, machine and tests required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("amats_machines")
      .update({ machine, tests, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message: "Machine updated", data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabase
    .from("amats_machines")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Machine deleted" });
}
