import Header from "@/components/Header";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";

export async function HomeHeader() {
	const bannerSettings = await getPublicSlidingBannerSettingsCached();
	return <Header bannerSettings={bannerSettings} />;
}

