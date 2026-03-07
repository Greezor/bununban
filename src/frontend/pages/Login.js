import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { css } from '@emotion/css'
import { Icon } from '@iconify/vue'

import ketchup from '../../common/utils/ketchup'

import InputGroup from 'primevue/inputgroup'
import Password from 'primevue/password'
import Button from 'primevue/button'

import logo from '../assets/logo.png'

const style = {
	page: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 20px;
		width: 100dvw;
		min-height: 100dvh;
	`,
	
	input: css`
		max-width: 300px;
	`,
}

export default {
	setup()
	{
		const router = useRouter();

		const password = ref('');
		const loading = ref(false);
		const error = ref(false);

		const auth = async () => {
			if( !password.value )
				return;

			loading.value = true;

			const success = await ketchup('/api/auth/login', {
				method: 'POST',
				json: password.value,
			});

			if( success )
				return router.replace('/');

			error.value = true;
			loading.value = false;
		}

		return {
			password,
			loading,
			error,
			auth,
		};
	},
	template: `
		<div class="${ style.page }">
			<img src="${ logo }" width="100" />

			<InputGroup class="${ style.input }">
				<Password
					v-model="password"
					:feedback="false"
					:invalid="error"
					:disabled="loading"
					placeholder="Пароль"
					@input="error = false"
					@keydown.enter="auth()" />

				<Button
					:disabled="loading"
					@click="auth()">
					<Icon
						v-if="loading"
						icon="svg-spinners:270-ring-with-bg" />

					<Icon
						v-else
						icon="fa7-solid:arrow-right" />
				</Button>
			</InputGroup>
		</div>
	`,
	components: {
		Icon,
		InputGroup,
		Password,
		Button,
	},
}