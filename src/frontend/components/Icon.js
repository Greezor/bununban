import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { getIconData } from '@iconify/utils'

import fa7solid from '@iconify-json/fa7-solid/icons.json'
import fa7brands from '@iconify-json/fa7-brands/icons.json'
import materialsymbols from '@iconify-json/material-symbols/icons.json'
import svgspinners from '@iconify-json/svg-spinners/icons.json'

export default {
	props: {
		icon: {
			type: String,
			required: true,
		},
	},
	setup(props)
	{
		const iconData = computed(() => {
			const [ prefix, name ] = props.icon.split(':');
			let lib;

			switch(prefix){
				case 'fa7-solid':
					lib = fa7solid;
					break;

				case 'fa7-brands':
					lib = fa7brands;
					break;

				case 'material-symbols':
					lib = materialsymbols;
					break;

				case 'svg-spinners':
					lib = svgspinners;
					break;
			}

			return getIconData(lib, name);
		})

		return { iconData }
	},
	template: `
		<Icon
			:icon="iconData"
			v-bind="$attrs" />
	`,
	components: {
		Icon,
	},
}