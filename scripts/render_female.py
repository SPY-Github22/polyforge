import bpy
import sys
import math
import os

# Clear existing objects
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import Female GLB
glb_path = "/home/sudpy/Downloads/PolyForge-Realistic-Female.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Set up studio lighting & environment
world = bpy.data.worlds.new("StudioWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.96, 0.96, 0.97, 1.0) # White studio environment
    bg_node.inputs[1].default_value = 1.0

# Add a ground plane for contact shadow
bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "StudioFloor"
floor_mat = bpy.data.materials.new(name="FloorMat")
floor_mat.use_nodes = True
floor_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
if floor_bsdf:
    floor_bsdf.inputs["Base Color"].default_value = (0.94, 0.94, 0.95, 1.0)
    floor_bsdf.inputs["Roughness"].default_value = 0.4
floor.data.materials.append(floor_mat)

# Key light
key_light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
key_light_data.energy = 3.5
key_light = bpy.data.objects.new(name="KeyLight", object_data=key_light_data)
bpy.context.scene.collection.objects.link(key_light)
key_light.rotation_euler = (math.radians(50), math.radians(25), math.radians(35))

# Fill light
fill_light_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_light_data.energy = 1.8
fill_light = bpy.data.objects.new(name="FillLight", object_data=fill_light_data)
bpy.context.scene.collection.objects.link(fill_light)
fill_light.rotation_euler = (math.radians(35), math.radians(-30), math.radians(-45))

# Rim light
rim_light_data = bpy.data.lights.new(name="RimLight", type='SUN')
rim_light_data.energy = 2.0
rim_light = bpy.data.objects.new(name="RimLight", object_data=rim_light_data)
bpy.context.scene.collection.objects.link(rim_light)
rim_light.rotation_euler = (math.radians(-45), 0, math.radians(180))

# Camera & Track-To Target
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 55 # 55mm portrait lens to reduce perspective distortion
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

target = bpy.data.objects.new("CameraTarget", None)
bpy.context.scene.collection.objects.link(target)

track = cam.constraints.new(type='TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'

bpy.context.scene.render.resolution_x = 800
bpy.context.scene.render.resolution_y = 1000

artifact_dir = "/home/sudpy/.gemini/antigravity-cli/brain/8bd8d386-8923-4fdf-beaa-399fc867af7a"

views = [
    ("female_render_full.png", (0, -2.8, 0.90), (0, 0, 0.90)),
    ("female_render_back.png", (0, 2.8, 0.90), (0, 0, 0.90)),
    ("female_render_head.png", (0, -0.58, 1.54), (0, 0, 1.54)),
    ("female_render_upper.png", (0, -1.35, 1.18), (0, 0, 1.18)),
    ("female_render_legs.png", (0, -1.5, 0.50), (0, 0, 0.50)),
    ("female_render_hand.png", (-0.42, -0.45, 0.78), (-0.28, 0, 0.78)),
]

for out_name, cam_pos, target_pos in views:
    cam.location = cam_pos
    target.location = target_pos
    bpy.context.view_layer.update()
    
    out_path = os.path.join(artifact_dir, out_name)
    bpy.context.scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_path}")
