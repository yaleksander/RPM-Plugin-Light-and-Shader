import { RPM } from "../path.js"
import { THREE } from "../../System/Globals.js";

const pluginName = "Light";
const inject = RPM.Manager.Plugins.inject;

const shadowMapSize = Math.pow(2, RPM.Manager.Plugins.getParameter(pluginName, "Shadow quality"));

var lightList = [];

var mapID = 0;
setInterval(function ()
{
	if (!!RPM.Scene.Map.current && !RPM.Scene.Map.current.loading)
	{
		if (mapID != RPM.Scene.Map.current.id)
		{
			lightList = [];
			mapID = RPM.Scene.Map.current.id;
			console.log("change map");
		}
		for (var i = 0; i < lightList.length; i++)
		{
			if (lightList[i].isDirectionalLight)
			{
				const x = lightList[i].extraStuff.x;
				const y = lightList[i].extraStuff.y;
				const z = lightList[i].extraStuff.z;
				lightList[i].target.position.copy(RPM.Scene.Map.current.camera.targetPosition);
				lightList[i].target.updateMatrixWorld();
				lightList[i].position.set(x, y, z).multiplyScalar(RPM.Datas.Systems.SQUARE_SIZE * 20).add(RPM.Scene.Map.current.camera.targetPosition);
				const d = Math.max(RPM.Datas.Systems.SQUARE_SIZE * RPM.Scene.Map.current.camera.distance / 10, 400);
				if (d !== lightList[i].shadow.camera.right)
				{
					lightList[i].shadow.camera.left = -d;
					lightList[i].shadow.camera.right = d;
					lightList[i].shadow.camera.top = d;
					lightList[i].shadow.camera.bottom = -d;
					lightList[i].shadow.camera.updateProjectionMatrix();
				}
			}
		}
	}
}, 16);

RPM.Manager.GL.load = async function()
{
	// Shaders
	var json;
	json = await RPM.Common.IO.openFile(RPM.Manager.Plugins.getParameter(pluginName, "Shaders directory path") + RPM.Manager.Plugins.getParameter(pluginName, "Shader") + ".vert");
	RPM.Manager.GL.SHADER_FIX_VERTEX = json;
	json = await RPM.Common.IO.openFile(RPM.Manager.Plugins.getParameter(pluginName, "Shaders directory path") + RPM.Manager.Plugins.getParameter(pluginName, "Shader") + ".frag");
	RPM.Manager.GL.SHADER_FIX_FRAGMENT = json;
	json = await RPM.Common.IO.openFile(RPM.Manager.Plugins.getParameter(pluginName, "Shaders directory path") + RPM.Manager.Plugins.getParameter(pluginName, "Shader") + ".vert");
	RPM.Manager.GL.SHADER_FACE_VERTEX = json;
	json = await RPM.Common.IO.openFile(RPM.Manager.Plugins.getParameter(pluginName, "Shaders directory path") + RPM.Manager.Plugins.getParameter(pluginName, "Shader") + ".frag");
	RPM.Manager.GL.SHADER_FACE_FRAGMENT = json;
}

function enableCastShadows(mesh, enable)
{
	if (!mesh.isScene)
	{
		mesh.castShadow = enable;
		mesh.receiveShadow = enable;
	}
	for (var i = 0; i < mesh.children.length; i++)
		enableCastShadows(mesh.children[i], enable);
}

RPM.Manager.Plugins.registerCommand(pluginName, "Remove all lights", () =>
{
	for (var i = 0; i < lightList.length; i++)
	{
		RPM.Scene.Map.current.scene.remove(lightList[i]);
		lightList[i].dispose();
	}
	lightList = [];
});

RPM.Manager.Plugins.registerCommand(pluginName, "Remove default directional light", (prop) =>
{
	for (var i = 0; i < RPM.Scene.Map.current.scene.children.length; i++)
	{
		if (RPM.Scene.Map.current.scene.children[i].isDirectionalLight && lightList.indexOf(RPM.Scene.Map.current.scene.children[i]) < 0)
		{
			if (prop > 0)
				RPM.Core.ReactionInterpreter.currentObject.properties[prop] = RPM.Scene.Map.current.scene.children[i];
			RPM.Scene.Map.current.scene.remove(RPM.Scene.Map.current.scene.children[i]);
			break;
		}
	}
});

RPM.Manager.Plugins.registerCommand(pluginName, "Remove default ambient light", (prop) =>
{
	for (var i = 0; i < RPM.Scene.Map.current.scene.children.length; i++)
	{
		if (RPM.Scene.Map.current.scene.children[i].isAmbientLight && lightList.indexOf(RPM.Scene.Map.current.scene.children[i]) < 0)
		{
			if (prop > 0)
				RPM.Core.ReactionInterpreter.currentObject.properties[prop] = RPM.Scene.Map.current.scene.children[i];
			RPM.Scene.Map.current.scene.remove(RPM.Scene.Map.current.scene.children[i]);
			break;
		}
	}
});

RPM.Manager.Plugins.registerCommand(pluginName, "Remove light", (light) =>
{
	if (!!light)
	{
		lightList.splice(lightList.indexOf(light), 1);
		light.parent.remove(light);
		light.dispose();
	}
});

RPM.Manager.Plugins.registerCommand(pluginName, "Add ambient light", (prop, intensity, color) =>
{
	const light = new THREE.AmbientLight(color, intensity);
	if (prop > 0)
		RPM.Core.ReactionInterpreter.currentObject.properties[prop] = light;
	RPM.Scene.Map.current.scene.add(light);
	lightList.push(light);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Add hemisphere light", (prop, intensity, colorTop, colorBottom) =>
{
	const light = new THREE.HemisphereLight(colorTop.color, colorBottom.color, intensity);
	if (prop > 0)
		RPM.Core.ReactionInterpreter.currentObject.properties[prop] = light;
	RPM.Scene.Map.current.scene.add(light);
	lightList.push(light);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Add directional light", (prop, x, y, z, intensity, color, castShadow) =>
{
	const light = new THREE.DirectionalLight(color.color, intensity);
	light.extraStuff = new THREE.Vector3(x, y, z).normalize();
	light.castShadow = castShadow;
	light.shadow.mapSize.width = 8192;
	light.shadow.mapSize.height = 8192;
	light.shadow.camera.far = RPM.Datas.Systems.SQUARE_SIZE * 350;
	light.shadow.bias = -0.00002;
	light.shadow.normalBias = 0.5;
	if (prop > 0)
		RPM.Core.ReactionInterpreter.currentObject.properties[prop] = light;
	RPM.Scene.Map.current.scene.add(light);
	lightList.push(light);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Add point light", (prop, id, x, y, z, intensity, color, radius, castShadow) =>
{
	const light = new THREE.PointLight(color.color, intensity);
	light.shadow.bias = -0.001;
	light.shadow.normalBias = 0.25;
	light.distance = radius * RPM.Datas.Systems.SQUARE_SIZE;
	light.position.set(x * RPM.Datas.Systems.SQUARE_SIZE, (y + 0.5) * RPM.Datas.Systems.SQUARE_SIZE, z * RPM.Datas.Systems.SQUARE_SIZE);
	light.castShadow = castShadow;
	for (var i = 0; i < RPM.Scene.Map.current.scene.children.length; i++)
		if (RPM.Scene.Map.current.scene.children[i].customDepthMaterial != null && !RPM.Scene.Map.current.scene.children[i].customDistanceMaterial)
			RPM.Scene.Map.current.scene.children[i].customDistanceMaterial = new THREE.MeshDistanceMaterial({alphaTest: 0.5, map: RPM.Scene.Map.current.scene.children[i].customDepthMaterial.map});
	RPM.Core.MapObject.search(id, (result) =>
	{
		if (!!result)
		{
			result.object.mesh.add(light);
			if (prop > 0)
				RPM.Core.ReactionInterpreter.currentObject.properties[prop] = light;
			lightList.push(light);
		}
	}, RPM.Core.ReactionInterpreter.currentObject);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Add spotlight", (prop, id, offX, offY, offZ, dirX, dirY, dirZ, intensity, color, angle, castShadow) =>
{
	const light = new THREE.SpotLight(color.color, intensity);
	light.position.set(offX * RPM.Datas.Systems.SQUARE_SIZE, offY * RPM.Datas.Systems.SQUARE_SIZE, offZ * RPM.Datas.Systems.SQUARE_SIZE);
	light.add(new THREE.Object3D());
	light.target = light.children[0];
	light.target.position.set(dirX, dirY, dirZ);
	light.castShadow = castShadow;
	light.angle = angle * Math.PI / 180.0;
	light.shadow.bias = -0.000001;
	light.shadow.normalBias = 0.25;
	light.penumbra = 1.0;
	RPM.Core.MapObject.search(id, (result) =>
	{
		if (!!result)
		{
			result.object.mesh.add(light);
			if (prop > 0)
				RPM.Core.ReactionInterpreter.currentObject.properties[prop] = light;
			lightList.push(light);
		}
	}, RPM.Core.ReactionInterpreter.currentObject);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set light color", (light, color) =>
{
	light.color = new THREE.Color(color);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set hemisphere light top color", (light, color) =>
{
	if (!light.isHemisphereLight)
		return;
	light.skyColor = new THREE.Color(color);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set hemisphere light bottom color", (light, color) =>
{
	if (!light.isHemisphereLight)
		return;
	light.groundColor = new THREE.Color(color);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set light intensity", (light, intensity) =>
{
	light.intensity = intensity;
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set light cast shadow", (light, castShadow) =>
{
	if (light.isAmbientLight || light.isHemisphereLight)
		return;
	light.castShadow = castShadow;
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set light position", (light, x, y, z) =>
{
	if (light.isAmbientLight || light.isHemisphereLight)
		return;
	light.position.set(x * RPM.Datas.Systems.SQUARE_SIZE, y * RPM.Datas.Systems.SQUARE_SIZE, z * RPM.Datas.Systems.SQUARE_SIZE);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set light direction", (light, x, y, z) =>
{
	if (!light.isDirectionalLight && !light.isSpotLight)
		return;
	light.target = light.children[0];
	light.target.position.set();
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set light target", (light, id) =>
{
	if (!light.isDirectionalLight && !light.isSpotLight)
		return;
	RPM.Core.MapObject.search(id, (result) =>
	{
		if (!!result)
			light.target = result.object.mesh;
	}, RPM.Core.ReactionInterpreter.currentObject);
});

RPM.Manager.Plugins.registerCommand(pluginName, "Set spotlight angle", (light, id) =>
{
	if (!light.isSpotLight)
		return;
	light.angle = angle * Math.PI / 180.0;
});
