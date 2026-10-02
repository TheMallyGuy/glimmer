<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown, TextField } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { getFlagValue, setFlagValue } from "$lib/flags";
  import { useIntlayer } from "svelte-intlayer";
  const commonContent = useIntlayer("common");
  const flagsPresetsContent = useIntlayer("flagsPresets");

  const flags = appState.fastflags.flags;

  const CSG_KEYS = [
    { key: "DFIntCSGLevelOfDetailSwitchingDistance", off: "250" },
    { key: "DFIntCSGLevelOfDetailSwitchingDistanceL12", off: "500" },
    { key: "DFIntCSGLevelOfDetailSwitchingDistanceL23", off: "750" },
    { key: "DFIntCSGLevelOfDetailSwitchingDistanceL34", off: "1000" },
  ] as const;
  const TEXTURE_ENABLED_KEY = "DFFlagTextureQualityOverrideEnabled";
  const TEXTURE_OVERRIDE_KEY = "DFIntTextureQualityOverride";
  const MSAA_KEY = "FIntDebugForceMSAASamples";
  const DPI_KEY = "DFFlagDisableDPIScale";
  const D3D11_KEY = "FFlagDebugGraphicsPreferD3D11";
  const VULKAN_KEY = "FFlagDebugGraphicsPreferVulkan";
  const OPENGL_KEY = "FFlagDebugGraphicsPreferOpenGL";
  const SKY_KEY = "FFlagDebugSkyGray";
  const VOXELIZER_KEY = "DFFlagDebugPauseVoxelizer";
  const FRM_QUALITY_KEY = "DFIntDebugFRMQualityLevelOverride";
  const MAX_GRASS_KEY = "FIntFRMMaxGrassDistance";
  const MIN_GRASS_KEY = "FIntFRMMinGrassDistance";
  const GRASS_MOTION_KEY = "FIntGrassMovementReducedMotionFactor";
  const ALT_ENTER_KEY = "FFlagHandleAltEnterFullscreenManually";

  const msaaItems = [
    { value: "0", label: "x0" },
    { value: "1", label: "x1" },
    { value: "2", label: "x2" },
    { value: "4", label: "x4" },
    { value: "8", label: "x8" },
  ];
  const textureItems = [
    { value: "-1", label: $commonContent.default.value },
    { value: "0", label: "0" },
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ];
  const graphicsApiItems = [
    { value: "default", label: $commonContent.default.value },
    { value: "d3d11", label: $flagsPresetsContent.graphicsApiDirect3D11.value },
    { value: "vulkan", label: $flagsPresetsContent.graphicsApiVulkan.value },
    { value: "opengl", label: $flagsPresetsContent.graphicsApiOpenGL.value },
  ];

  const altEnterFullscreen = $derived(
    getFlagValue(flags, ALT_ENTER_KEY) === "true",
  );
  const lowMeshQuality = $derived(
    CSG_KEYS.every((k) => (getFlagValue(flags, k.key) ?? k.off) === "0"),
  );
  const textureOverride = $derived(
    getFlagValue(flags, TEXTURE_ENABLED_KEY) === "true"
      ? (getFlagValue(flags, TEXTURE_OVERRIDE_KEY) ?? "3")
      : "-1",
  );
  const msaaSamples = $derived(getFlagValue(flags, MSAA_KEY) ?? "0");
  const disableDpiScale = $derived(getFlagValue(flags, DPI_KEY) === "true");
  const graphicsApi = $derived(
    getFlagValue(flags, D3D11_KEY) === "true"
      ? "d3d11"
      : getFlagValue(flags, VULKAN_KEY) === "true"
        ? "vulkan"
        : getFlagValue(flags, OPENGL_KEY) === "true"
          ? "opengl"
          : "default",
  );
  const graySky = $derived(getFlagValue(flags, SKY_KEY) === "true");

  const pauseVoxelizer = $derived(
    getFlagValue(flags, VOXELIZER_KEY) === "true",
  );
  const frmQualityOverride = $derived(
    getFlagValue(flags, FRM_QUALITY_KEY) ?? "0",
  );
  const maxGrassDistance = $derived(
    getFlagValue(flags, MAX_GRASS_KEY) ?? "290",
  );
  const minGrassDistance = $derived(
    getFlagValue(flags, MIN_GRASS_KEY) ?? "100",
  );
  const grassMotionFactor = $derived(
    getFlagValue(flags, GRASS_MOTION_KEY) ?? "5",
  );

  function setLowMeshQuality(on: boolean) {
    for (const k of CSG_KEYS) setFlagValue(flags, k.key, on ? "0" : k.off);
  }

  function setTextureOverride(v: string) {
    if (v === "-1") {
      setFlagValue(flags, TEXTURE_ENABLED_KEY, "false");
    } else {
      setFlagValue(flags, TEXTURE_ENABLED_KEY, "true");
      setFlagValue(flags, TEXTURE_OVERRIDE_KEY, v);
    }
  }

  function setGraphicsApi(v: string) {
    setFlagValue(flags, D3D11_KEY, v === "d3d11" ? "true" : "false");
    setFlagValue(flags, VULKAN_KEY, v === "vulkan" ? "true" : "false");
    setFlagValue(flags, OPENGL_KEY, v === "opengl" ? "true" : "false");
  }
</script>

<div class="flex flex-col gap-0.5">
  <SettingGroup label={$flagsPresetsContent.geometryGroup.value}>
    <SettingRow
      title={$flagsPresetsContent.lowMeshQuality.value}
      description={$flagsPresetsContent.lowMeshQualityDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$flagsPresetsContent.lowMeshQuality.value}
          checked={lowMeshQuality}
          onchange={setLowMeshQuality}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.pauseVoxelizer.value}
      description={$flagsPresetsContent.pauseVoxelizerDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$flagsPresetsContent.pauseVoxelizer.value}
          checked={pauseVoxelizer}
          onchange={(v) =>
            setFlagValue(flags, VOXELIZER_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$flagsPresetsContent.renderingGroup.value}>
    <SettingRow
      title={$flagsPresetsContent.preferredGraphicsApi.value}
      description={$flagsPresetsContent.preferredGraphicsApiDescription.value}
    >
      {#snippet control()}
        <Dropdown
          label={$flagsPresetsContent.preferredGraphicsApi.value}
          size="sm"
          width="160px"
          options={graphicsApiItems}
          value={graphicsApi}
          onchange={setGraphicsApi}
        />
      {/snippet}
    </SettingRow>
    <SettingRow title={$flagsPresetsContent.msaaSamples.value} description={$flagsPresetsContent.msaaSamplesDescription.value}>
      {#snippet control()}
        <Dropdown
          label={$flagsPresetsContent.msaaSamples.value}
          size="sm"
          width="120px"
          options={msaaItems}
          value={msaaSamples}
          onchange={(v) => setFlagValue(flags, MSAA_KEY, v)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.textureQualityOverride.value}
      description={$flagsPresetsContent.textureQualityOverrideDescription.value}
    >
      {#snippet control()}
        <Dropdown
          label={$flagsPresetsContent.textureQualityOverride.value}
          size="sm"
          width="140px"
          options={textureItems}
          value={textureOverride}
          onchange={setTextureOverride}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.graySky.value}
      description={$flagsPresetsContent.graySkyDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$flagsPresetsContent.graySky.value}
          checked={graySky}
          onchange={(v) => setFlagValue(flags, SKY_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.disableDpiScaling.value}
      description={$flagsPresetsContent.disableDpiScalingDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$flagsPresetsContent.disableDpiScaling.value}
          checked={disableDpiScale}
          onchange={(v) => setFlagValue(flags, DPI_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.renderQualityLevelOverride.value}
      description={$flagsPresetsContent.renderQualityLevelOverrideDescription.value}
    >
      {#snippet control()}
        <TextField
          label={$flagsPresetsContent.renderQualityLevelOverride.value}
          class="w-[120px]"
          value={frmQualityOverride}
          oninput={(e) =>
            setFlagValue(flags, FRM_QUALITY_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$flagsPresetsContent.grassGroup.value}>
    <SettingRow
      title={$flagsPresetsContent.maxGrassDistance.value}
      description={$flagsPresetsContent.maxGrassDistanceDescription.value}
    >
      {#snippet control()}
        <TextField
          label={$flagsPresetsContent.maxGrassDistance.value}
          class="w-[120px]"
          value={maxGrassDistance}
          oninput={(e) =>
            setFlagValue(flags, MAX_GRASS_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.minGrassDistance.value}
      description={$flagsPresetsContent.minGrassDistanceDescription.value}
    >
      {#snippet control()}
        <TextField
          label={$flagsPresetsContent.minGrassDistance.value}
          class="w-[120px]"
          value={minGrassDistance}
          oninput={(e) =>
            setFlagValue(flags, MIN_GRASS_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$flagsPresetsContent.grassMotionFactor.value}
      description={$flagsPresetsContent.grassMotionFactorDescription.value}
    >
      {#snippet control()}
        <TextField
          label={$flagsPresetsContent.grassMotionFactor.value}
          class="w-[120px]"
          value={grassMotionFactor}
          oninput={(e) =>
            setFlagValue(flags, GRASS_MOTION_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$flagsPresetsContent.windowGroup.value}>
    <SettingRow
      title={$flagsPresetsContent.handleAltEnter.value}
      description={$flagsPresetsContent.handleAltEnterDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$flagsPresetsContent.handleAltEnter.value}
          checked={altEnterFullscreen}
          onchange={(v) =>
            setFlagValue(flags, ALT_ENTER_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>
