begin;

-- Allow teachers/lecturers to register students for groups they are allowed to see.
-- Keep admin access unchanged.

drop policy if exists students_admin_write on public.students;
drop policy if exists student_groups_admin_write on public.student_groups;

-- Students: any authenticated teacher profile can create a student row.
-- Update is limited to students visible through the teacher's module scope.
create policy students_insert_teacher on public.students
  for insert
  with check (
    exists (
      select 1
      from public.teachers t
      where t.id = auth.uid()
    )
  );

create policy students_update_visible on public.students
  for update
  using (
    exists (
      select 1
      from public.teachers t
      where t.id = auth.uid()
        and t.role = 'admin'
    )
    or exists (
      select 1
      from public.student_groups sg
      join public.module_groups mg on mg.group_id = sg.group_id
      join public.modules m on m.id = mg.module_id
      where sg.student_id = students.id
        and (
          m.lecturer_id = auth.uid()
          or mg.assigned_teacher_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.teachers t
      where t.id = auth.uid()
        and t.role = 'admin'
    )
    or exists (
      select 1
      from public.student_groups sg
      join public.module_groups mg on mg.group_id = sg.group_id
      join public.modules m on m.id = mg.module_id
      where sg.student_id = students.id
        and (
          m.lecturer_id = auth.uid()
          or mg.assigned_teacher_id = auth.uid()
        )
    )
  );

create policy students_delete_admin on public.students
  for delete
  using (
    exists (
      select 1
      from public.teachers t
      where t.id = auth.uid()
        and t.role = 'admin'
    )
  );

-- Student-group links: teacher can write only for groups in their visible scope.
create policy student_groups_write_visible on public.student_groups
  for all
  using (
    exists (
      select 1
      from public.teachers t
      where t.id = auth.uid()
        and t.role = 'admin'
    )
    or exists (
      select 1
      from public.module_groups mg
      join public.modules m on m.id = mg.module_id
      where mg.group_id = student_groups.group_id
        and (
          m.lecturer_id = auth.uid()
          or mg.assigned_teacher_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.teachers t
      where t.id = auth.uid()
        and t.role = 'admin'
    )
    or exists (
      select 1
      from public.module_groups mg
      join public.modules m on m.id = mg.module_id
      where mg.group_id = student_groups.group_id
        and (
          m.lecturer_id = auth.uid()
          or mg.assigned_teacher_id = auth.uid()
        )
    )
  );

commit;
