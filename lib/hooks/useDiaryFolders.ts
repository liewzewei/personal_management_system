"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { DiaryEntry, DiaryFolder } from "@/types";

const DIARY_FOLDERS_QUERY_KEY = ["diary-folders"] as const;

async function fetchDiaryFolders(): Promise<DiaryFolder[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("diary_folders")
    .select("id,user_id,name,parent_folder_id,created_at,updated_at")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message || "Failed to fetch diary folders");
  return (data ?? []) as DiaryFolder[];
}

async function insertDiaryFolder(name: string, parentFolderId?: string | null): Promise<DiaryFolder> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name cannot be empty");

  const supabase = createBrowserSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("diary_folders")
    .insert({ user_id: userId, name: trimmed, parent_folder_id: parentFolderId ?? null })
    .select("id,user_id,name,parent_folder_id,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message || "Failed to create diary folder");
  return data as DiaryFolder;
}

async function patchDiaryFolder(folderId: string, newName: string): Promise<DiaryFolder> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Folder name cannot be empty");

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("diary_folders")
    .update({ name: trimmed })
    .eq("id", folderId)
    .select("id,user_id,name,parent_folder_id,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message || "Failed to rename diary folder");
  return data as DiaryFolder;
}

async function removeDiaryFolder(folderId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const [{ count: childCount, error: childError }, { count: entryCount, error: entryError }] = await Promise.all([
    supabase.from("diary_folders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("parent_folder_id", folderId),
    supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("folder_id", folderId),
  ]);

  if (childError) throw new Error(childError.message || "Failed to inspect folder contents");
  if (entryError) throw new Error(entryError.message || "Failed to inspect folder contents");

  if ((childCount ?? 0) > 0 || (entryCount ?? 0) > 0) {
    throw new Error("Cannot delete a folder that contains entries or subfolders. Move or delete the contents first.");
  }

  const { error } = await supabase.from("diary_folders").delete().eq("id", folderId).eq("user_id", userId);
  if (error) throw new Error(error.message || "Failed to delete diary folder");
}

async function moveFolder(folderId: string, newParentId: string | null): Promise<DiaryFolder> {
  if (folderId === newParentId) throw new Error("A folder cannot be its own parent");

  const supabase = createBrowserSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: folders, error: foldersError } = await supabase
    .from("diary_folders")
    .select("id,parent_folder_id")
    .eq("user_id", userId);

  if (foldersError) throw new Error(foldersError.message || "Failed to validate folder move");

  const parentById = new Map<string, string | null>((folders ?? []).map((folder) => [folder.id as string, (folder.parent_folder_id as string | null) ?? null]));
  let currentParent = newParentId;
  while (currentParent) {
    if (currentParent === folderId) {
      throw new Error("Cannot move a folder into its own descendant");
    }
    currentParent = parentById.get(currentParent) ?? null;
  }

  const { data, error } = await supabase
    .from("diary_folders")
    .update({ parent_folder_id: newParentId })
    .eq("id", folderId)
    .eq("user_id", userId)
    .select("id,user_id,name,parent_folder_id,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message || "Failed to move diary folder");
  return data as DiaryFolder;
}

export function useDiaryFolders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: DIARY_FOLDERS_QUERY_KEY,
    queryFn: fetchDiaryFolders,
    staleTime: 1000 * 60 * 5,
  });

  const createFolder = useMutation({
    mutationFn: ({ name, parentFolderId }: { name: string; parentFolderId?: string | null }) =>
      insertDiaryFolder(name, parentFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
    },
  });

  const renameFolder = useMutation({
    mutationFn: ({ folderId, newName }: { folderId: string; newName: string }) => patchDiaryFolder(folderId, newName),
    onMutate: async ({ folderId, newName }) => {
      await queryClient.cancelQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<DiaryFolder[]>(DIARY_FOLDERS_QUERY_KEY);
      queryClient.setQueryData<DiaryFolder[]>(DIARY_FOLDERS_QUERY_KEY, (old) =>
        (old ?? []).map((folder) =>
          folder.id === folderId ? { ...folder, name: newName.trim() || folder.name, updated_at: new Date().toISOString() } : folder
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(DIARY_FOLDERS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (folderId: string) => removeDiaryFolder(folderId),
    onMutate: async (folderId) => {
      await queryClient.cancelQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<DiaryFolder[]>(DIARY_FOLDERS_QUERY_KEY);
      queryClient.setQueryData<DiaryFolder[]>(DIARY_FOLDERS_QUERY_KEY, (old) =>
        (old ?? []).filter((folder) => folder.id !== folderId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(DIARY_FOLDERS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: ({ folderId, newParentId }: { folderId: string; newParentId: string | null }) =>
      moveFolder(folderId, newParentId),
    onMutate: async ({ folderId, newParentId }) => {
      await queryClient.cancelQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<DiaryFolder[]>(DIARY_FOLDERS_QUERY_KEY);
      queryClient.setQueryData<DiaryFolder[]>(DIARY_FOLDERS_QUERY_KEY, (old) =>
        (old ?? []).map((folder) =>
          folder.id === folderId
            ? { ...folder, parent_folder_id: newParentId, updated_at: new Date().toISOString() }
            : folder
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(DIARY_FOLDERS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY });
    },
  });

  return {
    folders: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: DIARY_FOLDERS_QUERY_KEY }),
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder: moveFolderMutation,
  };
}

export type DiaryFoldersQueryKey = typeof DIARY_FOLDERS_QUERY_KEY;

export function updateDiaryEntriesFolderInCache(
  entriesData: { pages: DiaryEntry[][]; pageParams: number[] } | undefined,
  entryId: string,
  folderId: string | null
) {
  if (!entriesData) return entriesData;
  return {
    ...entriesData,
    pages: entriesData.pages.map((page) =>
      page.map((entry) =>
        entry.id === entryId
          ? { ...entry, folder_id: folderId, updated_at: new Date().toISOString() }
          : entry
      )
    ),
  };
}
