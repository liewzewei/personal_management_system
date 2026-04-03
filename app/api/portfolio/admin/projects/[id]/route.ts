/**
 * GET    /api/portfolio/admin/projects/[id] — get a single project by ID.
 * PATCH  /api/portfolio/admin/projects/[id] — update a project.
 * DELETE /api/portfolio/admin/projects/[id] — delete a project.
 *
 * Authenticated endpoint — requires valid session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminProjectById, updateProject, deleteProject } from "@/lib/supabase";
import { updateProjectSchema } from "@/lib/validations/portfolio";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await getAdminProjectById(id);
    if (result.error) {
      const status = result.error.message === "Project not found" ? 404 : 500;
      return NextResponse.json({ data: null, error: result.error.message }, { status });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await updateProject(id, parsed.data);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await deleteProject(id);
    if (result.error) {
      return NextResponse.json({ data: null, error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: null, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Failed to delete project" }, { status: 500 });
  }
}
