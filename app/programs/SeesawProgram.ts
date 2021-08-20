import Matter from "matter-js";
import { LobbyController } from "../LobbyController";
import { Program } from "./Program";
import { SaftlimacherBaseProgram } from "./SaftlimacherBaseProgram";

export class SeesawProgram extends SaftlimacherBaseProgram implements Program {

  // world
  private gravityX: number = 0;
  private gravityY: number = 0.6;

  // ingredients
  private availableIngredientTypes = 4;
  private ingredientRadius = 40;
  private ingredientLeft0?: Matter.Body;
  private ingredientRight0?: Matter.Body;

  // seesaw 1 (left)
  private seesaw1?: Matter.Body;
  private seesawBeam1?: Matter.Body;

  // seesaw 2 (right)
  private seesaw2?: Matter.Body;
  private seesawBeam2?: Matter.Body;

  // container
  private shakerContainer?: Matter.Body;
  private garbageContainerLeft?: Matter.Body;
  private garbageContainerRight?: Matter.Body;
  private shakerContainerRadius = 70;

  // placement of seesaws
  private xSeesawLeftPosition = 1050;
  private xSeesawRightPosition = 1950;
  private ySeesawPosition = 600;
  private ySeesawBeamPosition = 640;
  private seesaw1Angle = 0;
  private seesaw2Angle = 0;

  // dimension of seesaws
  private seesawLength = 500;
  private seesawHeight = 40;
  private seesawBeamLenght = 20;
  private seesawBeamHeight = 100;

  //placment of containers
  private xGarbageContainerLeft = 600;
  private xShakerContainer = 1500;
  private xGarbageContainerRight = 2350;
  private yShakerContainer = 930;
  private yGarbageContainer = 1000;

  // placement of ingredients
  private xIngredientLeftPosition = 1050;
  private xIngredientRightPosition = 1950;

  constructor(lobbyController: LobbyController) {
    super(lobbyController);
  }

  /* -------------------- SEESAW GAME LOOP --------------------*/

  initGameLoop(fps: number) {
    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.seesaw1 == null || this.seesaw2 == null) return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('updateScore', this.score);
      this.lobbyController.sendToDisplays('seesaw1Position', [this.seesaw1.position.x, this.seesaw1.position.y, this.seesawLength, this.seesawHeight, this.seesaw1.angle]);
      this.lobbyController.sendToDisplays('seesaw2Position', [this.seesaw2.position.x, this.seesaw2.position.y, this.seesawLength, this.seesawHeight, this.seesaw2.angle]);
      this.lobbyController.sendToDisplays('seesawBeam1Position', [this.seesawBeam1?.position.x, this.seesawBeam1?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);
      this.lobbyController.sendToDisplays('seesawBeam2Position', [this.seesawBeam2?.position.x, this.seesawBeam2?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);

      if (this.ingredientLeft0 != null) {
        this.lobbyController.sendToDisplays('updateIngredientLeft0', [this.ingredientLeft0.position.x, this.ingredientLeft0.position.y, this.ingredientLeft0.angle]);
      }

      if (this.ingredientRight0 != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight0', [this.ingredientRight0.position.x, this.ingredientRight0.position.y, this.ingredientRight0.angle]);
      }

    }, 1000 / fps);
  }

  /* -------------------- SEESAW GAME METHODS --------------------*/

  initLevelData(): void {
    this.initSeesaws();
    this.initShakerContainer();
    this.initIngredients();
  }

  private initSeesaws(): void {
    if (this.engine == null) return;

    // seesaw1
    this.seesaw1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawPosition,
      this.seesawLength,
      this.seesawHeight,
      {
        label: 'Seesaw1',
        isSensor: false,
        isStatic: true,
        density: 1.0,
        friction: 0.0,
        restitution: 1.0,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1);

    this.seesawBeam1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawBeamPosition,
      this.seesawBeamLenght,
      this.seesawBeamHeight,
      {
        label: 'SeesawBeam1',
        isSensor: false,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesawBeam1);

    // seesaw2
    this.seesaw2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawPosition,
      this.seesawLength,
      this.seesawHeight,
      {
        label: 'Seesaw2',
        isSensor: false,
        isStatic: true,
        density: 1.0,
        friction: 0.0,
        restitution: 1.0,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2);

    this.seesawBeam2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawBeamPosition,
      this.seesawBeamLenght,
      this.seesawBeamHeight,
      {
        label: 'SeesawBeam2',
        isSensor: false,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesawBeam2);
  }

  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.xShakerContainer,
      this.yShakerContainer,
      this.shakerContainerRadius,
      {
        label: 'Container',
        isSensor: true,
        isStatic: true,
      });
    Matter.World.add(this.engine.world, this.shakerContainer);

    this.garbageContainerLeft = Matter.Bodies.circle(
      this.xGarbageContainerLeft,
      this.yGarbageContainer,
      this.shakerContainerRadius,
      {
        label: 'Garbage',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.garbageContainerLeft);

    this.garbageContainerRight = Matter.Bodies.circle(
      this.xGarbageContainerRight,
      this.yGarbageContainer,
      this.shakerContainerRadius,
      {
        label: 'Garbage',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.garbageContainerRight);
  }

  initIngredients(): void {
    if (this.engine == null) return;

    this.ingredientLeft0 = Matter.Bodies.circle(
      this.xIngredientLeftPosition,
      -50,
      this.ingredientRadius,
      {
        label: 'IngredientLeft0',
        isSensor: false,
        density: 0.1,
        friction: 0.0,
        restitution: 0.05,
      });
    Matter.World.add(this.engine.world, this.ingredientLeft0);

    this.ingredientRight0 = Matter.Bodies.circle(
      this.xIngredientRightPosition,
      -50,
      this.ingredientRadius,
      {
        label: 'IngredientRight0',
        isSensor: false,
        density: 0.1,
        friction: 0.0,
        restitution: 0.05,
      });
    Matter.World.add(this.engine.world, this.ingredientRight0);

  }

  initMatterEventCollision() {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        // SHAKE CONTAINER
        if (pair.bodyA.label.includes('Container') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Container') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient in container!
          let containerBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            containerBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }

          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          if (this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
            this.score += this.scoreInc;
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }

          // detect which side
          let isLeft = ingredientBody.label.includes('Left');
          this.respawnIngredient(ingredientBody, isLeft);
        }

        // GARBAGE
        if (pair.bodyA.label.includes('Garbage') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Garbage') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient in garbage!
          let containerBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            containerBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }

          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          if (!this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
            this.score += this.scoreInc;
            // this.lobbyController.sendToControllers('vibrate', [seesawNr]);
            // this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
            //  console.log('thrown away a good ingredient,, NOT on list!S -50 points!!');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }

          // detect which side
          let isLeft = ingredientBody.label.includes('Left');
          this.respawnIngredient(ingredientBody, isLeft);
        }

        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient')) {
          // ingredient touched the floor -> respawn
          if (pair.bodyB.label.includes('Ingredient')) {
            this.respawnIngredient(pair.bodyB, pair.bodyB.label.includes('Left'));
          } else {
            this.respawnIngredient(pair.bodyA, pair.bodyA.label.includes('Left'));
          }
        }
      }
    });
  }

  setControllerDataPlayer1(controllerData: number[]): void {
    this.seesaw1Angle = controllerData[0];
    let controllerId = controllerData[1];

    if (this.seesaw1Angle != null && controllerId != null && this.seesaw1 != undefined) {
      if (controllerId != 1) return;
      // controller1 data -> set angle of seesaw1
      Matter.Body.setAngle(this.seesaw1, this.seesaw1Angle);
    }
  }

  setControllerDataPlayer2(controllerData: number[]): void {
    this.seesaw2Angle = controllerData[0];
    let controllerId = controllerData[1];

    if (this.seesaw2Angle != null && controllerId != null && this.seesaw2 != undefined) {
      if (controllerId != 2) return;
      // controller2 data -> set angle of seesaw2
      Matter.Body.setAngle(this.seesaw2, this.seesaw2Angle);
    }
  }

  private respawnIngredient(body: Matter.Body, isLeft: Boolean) {
    let newNumber = this.getRandomInt(this.availableIngredientTypes);
    let newlabel = '';
    if (isLeft) {
      newlabel = "IngredientLeft" + newNumber;
    } else {
      newlabel = "IngredientRight" + newNumber;
    }

    body.label = newlabel;
    // remove forces from ingredient
    Matter.Body.setStatic(body, true);
    Matter.Body.setStatic(body, false);

    if (isLeft) {
      // respawn left ingredient
      Matter.Body.setPosition(body, {
        x: this.xIngredientLeftPosition,
        y: -200
      });
      this.lobbyController.sendToDisplays('changeImageIngredientLeft0', [newNumber]);

    } else {
      // respawn right ingredient
      Matter.Body.setPosition(body, {
        x: this.xIngredientRightPosition,
        y: -200
      });
      this.lobbyController.sendToDisplays('changeImageIngredientRight0', [newNumber]);
    }
  }

  collectLevelData() {
    let data: any[] = [];

    // 0 -> list
    data.push(this.allIngredientNumbersOnList);
    // 1 2 -> seesaw1
    data.push(this.seesaw1?.position.x);
    data.push(this.seesaw1?.position.y);
    // 3 4 -> seesaw2
    data.push(this.seesaw2?.position.x);
    data.push(this.seesaw2?.position.y);
    // 5 6 7 8 -> ingredients
    data.push(this.ingredientLeft0?.position.x);
    data.push(this.ingredientLeft0?.position.y);
    data.push(this.ingredientRight0?.position.x);
    data.push(this.ingredientRight0?.position.y);

    return data;
  }

  createWorldBounds(): void {
    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Left
      Matter.Bodies.rectangle(0, this.height / 2, 10, this.height, {
        isStatic: true,
        render: {
          visible: true,
        }
      }),
      // Bottom
      // not visible, further down -> trigger for respawning fruit
      Matter.Bodies.rectangle(this.width / 2, this.height + 400, this.width, 10, {
        label: 'Floor',
        isStatic: true,
        isSensor: true,
        render: {
          visible: true,
        }
      }),
      // Right
      Matter.Bodies.rectangle(this.width, this.height / 2, 10, this.height, {
        isStatic: true,
        render: {
          visible: true,
        }
      })
    ])
  }

  clearInGameTimers() {
    // no timers
  }

}