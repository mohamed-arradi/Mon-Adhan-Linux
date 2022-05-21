import json

with open('./resources/citydatas.json') as data_file:
    data = json.load(data_file)

for element in data:
        del element['code_region']
        # del element['longitude']
        # del element['latitude']
        # del element['code_commune_INSEE']
        # del element['nom_commune_postal']
        # del element['libelle_acheminement']
        # del element['code_commune']
        # del element['article']

with open('./resources/citydatas.json', 'w') as data_file:
    data = json.dump(data, data_file)