import { useModel, shallowRef, useTemplateRef, computed, watch, onMounted } from 'vue'
import * as monaco from 'monaco-editor'

export default {
	props: {
		modelValue: {
			type: String,
			default: '',
		},
		options: {
			type: Object,
			default: () => ({}),
		},
		loading: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:modelValue'],
	setup(props)
	{
		const model = useModel(props, 'modelValue');

		const container = useTemplateRef('container');
		const editor = shallowRef(null);
		const editorModel = shallowRef(null);

		const editorOptions = computed(() => ({
			value: model.value,
			theme: 'vs-dark',
			minimap: { enabled: true },
			automaticLayout: true,
			readOnly: false,

			...props.options,

			...(
				props.loading
					? { readOnly: true }
					: {}
			),
		}));

		const initEditor = () => {
			editor.value = monaco.editor.create(container.value, editorOptions.value);

			editorModel.value = editor.value.getModel();

			editorModel.value.onDidChangeContent(() => {
				if( props.loading )
					return;

				model.value = editorModel.value.getValue();
			});
		}

		watch(
			() => model.value,
			value => {
				if( value !== editorModel.value?.getValue?.() )
					editorModel.value?.setValue?.(value);
			},
		);

		watch(
			() => props,
			() => editor.value.updateOptions(editorOptions.value),
			{ deep: true },
		);

		let loadingText;
		let loadingInterval;

		const onUpdateLoadingState = () => {
			clearInterval(loadingInterval);

			if( props.loading ){
				loadingText = '';
				editorModel.value?.setValue?.(loadingText);

				loadingInterval = setInterval(() => {
					loadingText += '.';

					if( loadingText === '......' )
						loadingText = '';

					editorModel.value?.setValue?.(loadingText);
				}, 100);
			}else{
				editorModel.value?.setValue?.(model.value);
			}
		}

		watch(
			() => props.loading,
			() => onUpdateLoadingState(),
		);

		onMounted(() => {
			initEditor();

			if( props.loading )
				onUpdateLoadingState();
		});
	},
	template: `
		<div ref="container"></div>
	`,
}