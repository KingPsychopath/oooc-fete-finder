import { SubmitEventForm } from "@/features/events/submissions/SubmitEventForm";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import { loadGenreTaxonomySnapshot } from "@/lib/platform/postgres/music-genre-taxonomy-repository";
import { unstable_cache as cache } from "next/cache";

const getSubmitEventFormDataCached = cache(
	async () => {
		const [settings, genreTaxonomy] = await Promise.all([
			EventSubmissionSettingsStore.getPublicSettings(),
			loadGenreTaxonomySnapshot(),
		]);
		return { settings, genreTaxonomy };
	},
	["submit-event-form-data"],
	{
		revalidate: 3600,
		tags: ["events", "events-data", "event-submission-settings"],
	},
);

export async function SubmitEventFormSection() {
	const { settings, genreTaxonomy } = await getSubmitEventFormDataCached();
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
