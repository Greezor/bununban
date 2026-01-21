import { useModel } from 'vue'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import Butn from '../components/Butn'
import Loader from '../components/Loader'

const style = {
	page: css`
		position: relative;
		display: flex;
		width: 100dvw;
		height: 100dvh;
		overflow: hidden;
	`,

	sidebar: css`
		--mobile-view: 0;
		margin-left: 0;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		flex: 0 0 400px;
		max-width: 50dvw;
		transition: all 0.3s ease;

		@media (max-width: 750px){
			margin-left: calc(-100dvw * var(--mobile-view));
			flex: 0 0 100dvw;
			max-width: 100dvw;
		}
	`,

	sidebarHeader: css`
		font-size: 20px;
	`,

	main: css`
		flex: 1 1 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		max-width: 100dvw;

		@media (max-width: 750px){
			flex: 0 0 100dvw;
		}
	`,

	mobileBackBtn: css`
		--show: 0;
		position: absolute;
		top: 50%;
		left: 0;
		transform: translateY(-50%);
		padding: 10px;
		border-radius: 0 100px 100px 0;
		transition: all 0.3s ease;
		opacity: 0;
		z-index: 10;

		@media (max-width: 750px){
			opacity: var(--show);
		}
	`,
}

export default {
	props: {
		header: {
			type: String,
			default: '',
		},
		mobileView: {
			type: Boolean,
			default: false,
		},
		loading: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:mobileView', 'back'],
	setup(props)
	{
		const mobileViewModel = useModel(props, 'mobileView');

		return {
			mobileViewModel,
		};
	},
	template: `
		<div class="${ style.page }">
			<div
				class="${ style.sidebar }"
				:style="{ '--mobile-view': Number(mobileViewModel) }">
				<div
					v-if="!!header"
					class="${ style.sidebarHeader }">
					<slot name="header">{{ header }}</slot>
				</div>

				<slot name="sidebar"></slot>
			</div>

			<div class="${ style.main }">
				<slot></slot>
			</div>

			<Butn
				class="${ style.mobileBackBtn }"
				:style="{ '--show': Number(mobileViewModel) }"
				@click="
					$emit('back');
					mobileViewModel = false;
				">
				<Icon icon="material-symbols:arrow-back-rounded" width="20" />
			</Butn>

			<Loader v-if="loading" />
		</div>
	`,
	components: {
		Icon,
		Butn,
		Loader,
	},
}