import { SubmitEventForm } from "@/features/events/submissions/SubmitEventForm";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import { loadGenreTaxonomySnapshot } from "@/lib/platform/postgres/music-genre-taxonomy-repository";

export async function SubmitEventFormSection() {
	const [settings, genreTaxonomy] = await Promise.all([
		EventSubmissionSettingsStore.getPublicSettings(),
		loadGenreTaxonomySnapshot(),
	]);
	const genreOptions = genreTaxonomy.genres.filter(
		(genre) => genre.isActive !== false,
	);
	return (
		<SubmitEventForm
			submissionsEnabled={settings.newEventsEnabled}
			genreOptions={genreOptions}
		/>
	);
}
