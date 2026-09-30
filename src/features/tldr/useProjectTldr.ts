import { useTldrView, type TldrViewState } from '@/features/tldr/useTldrView';
import type { ProjectTldrView } from '@/lib/bindings/ProjectTldrView';
import type { TldrChangedEvent } from '@/lib/bindings/TldrChangedEvent';
import { loadProjectTldr } from '@/lib/tldr';

function concernsProject(event: TldrChangedEvent, projectId: string): boolean {
  return event.projectId === projectId;
}

/** TL;DR eines Vorhabens samt Kurzfassungen seiner Sessions: beim Wählen und bei jedem `tldr://changed`
 *  des Vorhabens, auch wenn es nur eine seiner Sessions betrifft. */
export function useProjectTldr(projectId: string): TldrViewState<ProjectTldrView> {
  return useTldrView<ProjectTldrView>(projectId, loadProjectTldr, concernsProject);
}
